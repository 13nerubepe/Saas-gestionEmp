from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from core.models import BaseModel, CompanyOwnedModel

AMOUNT = {"max_digits": 18, "decimal_places": 2}


class Invoice(CompanyOwnedModel):
    """US-14: an invoice to a client.

    A draft can be edited or deleted. Issuing gives it its number and freezes
    it: the seller and client details are copied so later edits of the client
    record never change an issued invoice. Corrections will go through a credit
    note, never an edit.
    """

    class Kind(models.TextChoices):
        INVOICE = "invoice", _("Invoice")
        # Cancels an issued invoice; numbered in its own sequence (AV-2026-0001).
        CREDIT_NOTE = "credit_note", _("Credit note")

    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")
        ISSUED = "issued", _("Issued")
        # Set by the payment service once the payments cover the total.
        PAID = "paid", _("Paid")
        # Set when a credit note cancels the invoice.
        CANCELLED = "cancelled", _("Cancelled")

    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.INVOICE)
    # For a credit note: the invoice it cancels.
    credited_invoice = models.OneToOneField(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="credit_note"
    )

    client = models.ForeignKey("crm.Client", on_delete=models.PROTECT, related_name="invoices")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    # Empty on drafts; unique per company once issued (see Meta).
    number = models.CharField(max_length=50, blank=True)
    issue_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=3, help_text="ISO 4217, copied from the company")
    notes = models.TextField(blank=True)

    # Totals, recomputed by the services each time the lines change.
    subtotal = models.DecimalField(**AMOUNT, default=0)
    tax_total = models.DecimalField(**AMOUNT, default=0)
    total = models.DecimalField(**AMOUNT, default=0)
    # Sum of the payments, kept by billing.services.record_payment.
    amount_paid = models.DecimalField(**AMOUNT, default=0)

    # Frozen when the invoice is issued.
    seller_name = models.CharField(max_length=255, blank=True)
    seller_tax_id = models.CharField(max_length=100, blank=True)
    seller_trade_register = models.CharField(max_length=100, blank=True)
    seller_address = models.CharField(max_length=500, blank=True)
    client_name = models.CharField(max_length=255, blank=True)
    client_tax_id = models.CharField(max_length=100, blank=True)
    client_address = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "number"],
                condition=~models.Q(number=""),
                name="unique_invoice_number_per_company",
            ),
        ]

    def __str__(self):
        return self.number or f"Draft {self.id}"

    @property
    def balance_due(self):
        return self.total - self.amount_paid


class InvoiceLine(BaseModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    position = models.PositiveIntegerField()
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(**AMOUNT)
    # Copied from the country rules when the line is written, so a later rate
    # change never alters an existing invoice.
    tax_rate_code = models.CharField(max_length=20)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2)
    subtotal = models.DecimalField(**AMOUNT)
    tax_amount = models.DecimalField(**AMOUNT)

    class Meta:
        ordering = ["position"]

    def __str__(self):
        return self.description


class InvoiceSequence(CompanyOwnedModel):
    """Last invoice number used by a company in a year: numbers never skip."""

    year = models.PositiveIntegerField()
    # One sequence per document type: FAC (invoices), AV (credit notes).
    prefix = models.CharField(max_length=10, default="FAC")
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "year", "prefix"], name="unique_sequence_per_year_and_prefix"
            ),
        ]


class Payment(CompanyOwnedModel):
    """US-15: money received for an invoice, entered by the founder.

    Never edited or deleted: like the invoice it pays, it is part of the books.
    """

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(**AMOUNT)
    paid_on = models.DateField()
    # A code from the country rules (cash, MTN Mobile Money, bank transfer…).
    method = models.CharField(max_length=30)
    reference = models.CharField(
        max_length=100, blank=True, help_text="Transaction id, cheque number…"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    # A correction is a new, negative payment pointing to the one it cancels.
    reversal_of = models.OneToOneField(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="reversal"
    )
    reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-paid_on", "-created_at"]

    def __str__(self):
        return f"{self.amount} {self.invoice.currency} — {self.invoice}"


class CashMovement(CompanyOwnedModel):
    """Money in or out of the business that is not an invoice payment (M4).

    Entered by hand: no bank integration. Together with the payments it gives
    the cash position. Never edited or deleted: a mistake is corrected by a
    reversing movement, like payments.
    """

    class Direction(models.TextChoices):
        IN = "in", _("Money in")
        OUT = "out", _("Money out")

    class Category(models.TextChoices):
        OPENING_BALANCE = "opening_balance", _("Opening balance")
        SALE = "sale", _("Sale without invoice")
        OWNER_CONTRIBUTION = "owner_contribution", _("Owner contribution")
        LOAN = "loan", _("Loan")
        SUPPLIES = "supplies", _("Supplies and goods")
        RENT = "rent", _("Rent")
        STAFF = "staff", _("Staff")
        TRANSPORT = "transport", _("Transport")
        UTILITIES = "utilities", _("Water, power, phone, internet")
        TAXES = "taxes", _("Taxes and duties")
        BANK_FEES = "bank_fees", _("Bank and mobile money fees")
        OWNER_WITHDRAWAL = "owner_withdrawal", _("Owner withdrawal")
        OTHER = "other", _("Other")

    direction = models.CharField(max_length=3, choices=Direction.choices)
    category = models.CharField(max_length=30, choices=Category.choices)
    # Positive; negative only on a reversal.
    amount = models.DecimalField(**AMOUNT)
    occurred_on = models.DateField()
    method = models.CharField(max_length=30, help_text="A payment method code of the country")
    label = models.CharField(max_length=255)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    reversal_of = models.OneToOneField(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="reversal"
    )
    reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-occurred_on", "-created_at"]
        indexes = [models.Index(fields=["company", "occurred_on"])]

    def __str__(self):
        return f"{self.get_direction_display()} {self.amount} — {self.label}"
