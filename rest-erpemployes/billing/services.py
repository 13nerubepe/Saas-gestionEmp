"""Writes and business rules of invoicing (US-14).

Every change to an invoice goes through these functions: views never save an
Invoice or an InvoiceLine themselves. That keeps the rules in one place: only
drafts change, totals always match the lines, numbers never skip.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers, status
from rest_framework.exceptions import APIException

from billing.models import CashMovement, Invoice, InvoiceLine, InvoiceSequence, Payment
from billing.rules import rules_for


class InvoicingNotAvailable(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _("Invoicing is not available yet for your company's country.")
    default_code = "invoicing_not_available"


class InvoiceNotDraft(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = _("An issued invoice can no longer be changed.")
    default_code = "invoice_not_draft"


class InvoiceEmpty(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _("Add at least one line before issuing the invoice.")
    default_code = "invoice_empty"


class SellerDetailsMissing(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _("Complete your company details (taxpayer number) before issuing.")
    default_code = "seller_details_missing"


class InvoiceNotPayable(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = _("Only an issued invoice with a balance due can receive a payment.")
    default_code = "invoice_not_payable"


class PaymentExceedsBalance(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _("The payment is larger than the balance due.")
    default_code = "payment_exceeds_balance"


class InvoiceHasPayments(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = _("Reverse the payments of this invoice before cancelling it.")
    default_code = "invoice_has_payments"


class NotCancellable(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = _("Only an issued invoice can be cancelled by a credit note.")
    default_code = "invoice_not_cancellable"


class AlreadyReversed(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = _("This entry is already reversed, or is itself a reversal.")
    default_code = "already_reversed"


def _rules(company):
    rules = rules_for(company.country)
    if rules is None:
        raise InvoicingNotAvailable()
    return rules


def _round(amount, decimals):
    return amount.quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP)


def _write_lines(invoice, lines, rules):
    """Replace the invoice's lines and recompute its totals."""
    rates = {rate.code: rate for rate in rules.tax_rates}
    decimals = rules.currency_decimals

    built = []
    for position, line in enumerate(lines, start=1):
        code = line.get("tax_rate_code") or rules.default_tax_rate
        rate = rates.get(code)
        if rate is None:
            raise serializers.ValidationError(
                {"lines": [_("Unknown tax rate: %(code)s.") % {"code": code}]},
                code="invalid_tax_rate",
            )
        subtotal = _round(line["quantity"] * line["unit_price"], decimals)
        built.append(
            InvoiceLine(
                invoice=invoice,
                position=position,
                description=line["description"],
                quantity=line["quantity"],
                unit_price=line["unit_price"],
                tax_rate_code=rate.code,
                tax_rate=rate.rate,
                subtotal=subtotal,
                tax_amount=_round(subtotal * rate.rate / 100, decimals),
            )
        )

    invoice.lines.all().delete()
    InvoiceLine.objects.bulk_create(built)
    invoice.subtotal = sum((line.subtotal for line in built), Decimal(0))
    invoice.tax_total = sum((line.tax_amount for line in built), Decimal(0))
    invoice.total = invoice.subtotal + invoice.tax_total
    invoice.save()


@transaction.atomic
def create_invoice(*, company, client, lines, due_date=None, notes=""):
    """A new draft invoice for `client`, in the company's currency."""
    rules = _rules(company)
    invoice = Invoice.objects.create(
        company=company, client=client, due_date=due_date, notes=notes, currency=rules.currency
    )
    _write_lines(invoice, lines, rules)
    return invoice


@transaction.atomic
def update_invoice(invoice, *, client, lines, due_date=None, notes=""):
    """Replace a draft's client, dates, notes and lines."""
    if invoice.status != Invoice.Status.DRAFT:
        raise InvoiceNotDraft()
    invoice.client = client
    invoice.due_date = due_date
    invoice.notes = notes
    _write_lines(invoice, lines, _rules(invoice.company))
    return invoice


def delete_invoice(invoice):
    """Only drafts can be deleted: an issued number must stay in the sequence."""
    if invoice.status != Invoice.Status.DRAFT:
        raise InvoiceNotDraft()
    invoice.delete()


def _next_number(company, prefix, year):
    """Next number of a yearly sequence, e.g. FAC-2026-0007.

    The sequence row is locked (SELECT ... FOR UPDATE) until the transaction
    ends, so two documents issued at the same moment never share a number,
    and a failure rolls the increment back, so no number is ever skipped.
    Call it inside transaction.atomic.
    """
    sequence, _created = InvoiceSequence.objects.get_or_create(
        company=company, year=year, prefix=prefix
    )
    sequence = InvoiceSequence.objects.select_for_update().get(pk=sequence.pk)
    sequence.last_number += 1
    sequence.save(update_fields=["last_number", "updated_at"])
    return f"{prefix}-{year}-{sequence.last_number:04d}"


def _freeze_seller(document, company):
    document.seller_name = company.name
    document.seller_tax_id = company.tax_id
    document.seller_trade_register = company.trade_register
    document.seller_address = company.address


@transaction.atomic
def issue_invoice(invoice, *, today=None):
    """Give the draft its number and freeze it.

    The number is the next one of the company's yearly sequence, e.g.
    FAC-2026-0007. The sequence row is locked (SELECT ... FOR UPDATE) so two
    invoices issued at the same moment never get the same number, and a
    failure rolls the whole issue back, so no number is ever skipped.
    """
    # Lock the invoice too: issuing it twice at once must not use two numbers.
    invoice = (
        Invoice.objects.select_for_update().select_related("company", "client").get(pk=invoice.pk)
    )
    if invoice.status != Invoice.Status.DRAFT:
        raise InvoiceNotDraft()
    if not invoice.lines.exists():
        raise InvoiceEmpty()

    company = invoice.company
    rules = _rules(company)
    if any(not getattr(company, field) for field in rules.required_seller_fields):
        raise SellerDetailsMissing()

    today = today or timezone.localdate()
    client = invoice.client
    invoice.number = _next_number(company, rules.invoice_prefix, today.year)
    invoice.status = Invoice.Status.ISSUED
    invoice.issue_date = today
    # No due date: payable on receipt.
    invoice.due_date = invoice.due_date or today
    _freeze_seller(invoice, company)
    invoice.client_name = client.name
    invoice.client_tax_id = client.tax_id
    invoice.client_address = ", ".join(
        part for part in (client.address, client.city, client.country) if part
    )
    invoice.save()
    return invoice


@transaction.atomic
def record_payment(invoice, *, amount, paid_on, method, user, reference=""):
    """Record money received for an issued invoice (US-15).

    The invoice row is locked so two payments entered at the same moment
    cannot both pass the balance check. When the payments cover the total,
    the invoice becomes paid.
    """
    invoice = Invoice.objects.select_for_update().select_related("company").get(pk=invoice.pk)
    if invoice.kind != Invoice.Kind.INVOICE or invoice.status != Invoice.Status.ISSUED:
        raise InvoiceNotPayable()

    rules = _rules(invoice.company)
    amount = _positive_amount(amount, rules)
    if amount > invoice.balance_due:
        raise PaymentExceedsBalance()
    _check_method(rules, method)
    _check_not_future(paid_on, "paid_on")

    payment = Payment.objects.create(
        company=invoice.company,
        invoice=invoice,
        amount=amount,
        paid_on=paid_on,
        method=method,
        reference=reference,
        created_by=user,
    )
    invoice.amount_paid += amount
    if invoice.balance_due == 0:
        invoice.status = Invoice.Status.PAID
    invoice.save(update_fields=["amount_paid", "status", "updated_at"])
    return payment


def _check_method(rules, method):
    if method not in {m.code for m in rules.payment_methods}:
        raise serializers.ValidationError(
            {"method": [_("Unknown payment method.")]}, code="invalid_payment_method"
        )


def _check_not_future(day, field):
    if day > timezone.localdate():
        raise serializers.ValidationError(
            {field: [_("This date is in the future.")]}, code="future_date"
        )


def _positive_amount(amount, rules):
    amount = _round(amount, rules.currency_decimals)
    if amount <= 0:
        raise serializers.ValidationError(
            {"amount": [_("The amount must be positive.")]}, code="invalid_amount"
        )
    return amount


@transaction.atomic
def reverse_payment(payment, *, reason, user):
    """Cancel a payment entered by mistake, without deleting it.

    A new payment of the opposite amount points to the original, with the
    reason: the history stays whole and the totals are right. The invoice goes
    back to "issued" if it was paid.
    """
    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.reversal_of_id or Payment.objects.filter(reversal_of=payment).exists():
        raise AlreadyReversed()
    invoice = Invoice.objects.select_for_update().get(pk=payment.invoice_id)

    reversal = Payment.objects.create(
        company=payment.company,
        invoice=invoice,
        amount=-payment.amount,
        paid_on=timezone.localdate(),
        method=payment.method,
        reference=payment.reference,
        created_by=user,
        reversal_of=payment,
        reason=reason,
    )
    invoice.amount_paid -= payment.amount
    if invoice.status == Invoice.Status.PAID and invoice.balance_due > 0:
        invoice.status = Invoice.Status.ISSUED
    invoice.save(update_fields=["amount_paid", "status", "updated_at"])
    return reversal


@transaction.atomic
def create_credit_note(invoice, *, reason, user=None, today=None):
    """Cancel an issued invoice with a credit note (avoir) for its full amount.

    An issued invoice is never edited or deleted: the credit note, numbered in
    its own sequence (AV-2026-0001), cancels it in the books. Payments must be
    reversed first, so the money side stays explicit.
    """
    invoice = (
        Invoice.objects.select_for_update().select_related("company", "client").get(pk=invoice.pk)
    )
    if invoice.kind != Invoice.Kind.INVOICE or invoice.status != Invoice.Status.ISSUED:
        raise NotCancellable()
    if invoice.amount_paid != 0:
        raise InvoiceHasPayments()

    company = invoice.company
    rules = _rules(company)
    today = today or timezone.localdate()
    credit_note = Invoice.objects.create(
        company=company,
        client=invoice.client,
        kind=Invoice.Kind.CREDIT_NOTE,
        credited_invoice=invoice,
        status=Invoice.Status.ISSUED,
        number=_next_number(company, rules.credit_note_prefix, today.year),
        issue_date=today,
        currency=invoice.currency,
        notes=reason,
        subtotal=invoice.subtotal,
        tax_total=invoice.tax_total,
        total=invoice.total,
        client_name=invoice.client_name,
        client_tax_id=invoice.client_tax_id,
        client_address=invoice.client_address,
    )
    _freeze_seller(credit_note, company)
    credit_note.save()
    InvoiceLine.objects.bulk_create(
        InvoiceLine(
            invoice=credit_note,
            position=line.position,
            description=line.description,
            quantity=line.quantity,
            unit_price=line.unit_price,
            tax_rate_code=line.tax_rate_code,
            tax_rate=line.tax_rate,
            subtotal=line.subtotal,
            tax_amount=line.tax_amount,
        )
        for line in invoice.lines.all()
    )
    invoice.status = Invoice.Status.CANCELLED
    invoice.save(update_fields=["status", "updated_at"])
    return credit_note


# Which way money goes for each category ("other" goes both ways).
_MONEY_IN = {
    CashMovement.Category.OPENING_BALANCE,
    CashMovement.Category.SALE,
    CashMovement.Category.OWNER_CONTRIBUTION,
    CashMovement.Category.LOAN,
}


def record_cash_movement(*, company, direction, category, amount, occurred_on, method, label, user):
    """Money in or out that is not an invoice payment, entered by the founder."""
    rules = _rules(company)
    amount = _positive_amount(amount, rules)
    _check_method(rules, method)
    _check_not_future(occurred_on, "occurred_on")
    if category != CashMovement.Category.OTHER and (category in _MONEY_IN) != (
        direction == CashMovement.Direction.IN
    ):
        raise serializers.ValidationError(
            {"category": [_("This category does not match the direction of the movement.")]},
            code="invalid_category",
        )
    return CashMovement.objects.create(
        company=company,
        direction=direction,
        category=category,
        amount=amount,
        occurred_on=occurred_on,
        method=method,
        label=label,
        created_by=user,
    )


@transaction.atomic
def reverse_cash_movement(movement, *, reason, user):
    """Cancel a cash movement entered by mistake, keeping both lines."""
    movement = CashMovement.objects.select_for_update().get(pk=movement.pk)
    if movement.reversal_of_id or CashMovement.objects.filter(reversal_of=movement).exists():
        raise AlreadyReversed()
    return CashMovement.objects.create(
        company=movement.company,
        direction=movement.direction,
        category=movement.category,
        amount=-movement.amount,
        occurred_on=timezone.localdate(),
        method=movement.method,
        label=movement.label,
        created_by=user,
        reversal_of=movement,
        reason=reason,
    )
