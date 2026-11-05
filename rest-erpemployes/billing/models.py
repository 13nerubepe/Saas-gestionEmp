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

    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")
        ISSUED = "issued", _("Issued")
        # Set by the payment service once the payments cover the total.
        PAID = "paid", _("Paid")

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
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "year"], name="unique_sequence_per_year"),
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

    class Meta:
        ordering = ["-paid_on", "-created_at"]

    def __str__(self):
        return f"{self.amount} {self.invoice.currency} — {self.invoice}"
