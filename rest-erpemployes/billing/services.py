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

from billing.models import Invoice, InvoiceLine, InvoiceSequence
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
    sequence, _created = InvoiceSequence.objects.get_or_create(company=company, year=today.year)
    sequence = InvoiceSequence.objects.select_for_update().get(pk=sequence.pk)
    sequence.last_number += 1
    sequence.save(update_fields=["last_number", "updated_at"])

    client = invoice.client
    invoice.number = f"{rules.invoice_prefix}-{today.year}-{sequence.last_number:04d}"
    invoice.status = Invoice.Status.ISSUED
    invoice.issue_date = today
    # No due date: payable on receipt.
    invoice.due_date = invoice.due_date or today
    invoice.seller_name = company.name
    invoice.seller_tax_id = company.tax_id
    invoice.client_name = client.name
    invoice.client_tax_id = client.tax_id
    invoice.client_address = ", ".join(
        part for part in (client.address, client.city, client.country) if part
    )
    invoice.save()
    return invoice
