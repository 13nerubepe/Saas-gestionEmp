from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from billing.models import CashMovement, Invoice, InvoiceLine, Payment
from crm.models import Client


class InvoiceLineSerializer(serializers.ModelSerializer):
    # Optional on input: the country's default rate applies.
    tax_rate_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    unit_price = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal(0))

    class Meta:
        model = InvoiceLine
        fields = [
            "description",
            "quantity",
            "unit_price",
            "tax_rate_code",
            "tax_rate",
            "subtotal",
            "tax_amount",
        ]
        read_only_fields = ["tax_rate", "subtotal", "tax_amount"]


class PaymentSerializer(serializers.ModelSerializer):
    reversal_of = serializers.UUIDField(source="reversal_of_id", allow_null=True)
    is_reversed = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "amount",
            "paid_on",
            "method",
            "reference",
            "reversal_of",
            "reason",
            "is_reversed",
            "created_at",
        ]
        read_only_fields = fields

    def get_is_reversed(self, payment) -> bool:
        return hasattr(payment, "reversal")


class ReasonSerializer(serializers.Serializer):
    """Why a payment, a cash movement or an invoice is cancelled: kept in the books."""

    reason = serializers.CharField(min_length=3, max_length=255)


class CashMovementSerializer(serializers.ModelSerializer):
    reversal_of = serializers.UUIDField(source="reversal_of_id", allow_null=True, read_only=True)
    is_reversed = serializers.SerializerMethodField()

    class Meta:
        model = CashMovement
        fields = [
            "id",
            "direction",
            "category",
            "amount",
            "occurred_on",
            "method",
            "label",
            "reversal_of",
            "reason",
            "is_reversed",
            "created_at",
        ]
        read_only_fields = ["id", "reversal_of", "reason", "is_reversed", "created_at"]

    def get_is_reversed(self, movement) -> bool:
        return hasattr(movement, "reversal")


class PaymentWriteSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    paid_on = serializers.DateField()
    # Checked against the country's payment methods by the service.
    method = serializers.CharField(max_length=30)
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")


class InvoiceSerializer(serializers.ModelSerializer):
    """Read side: an invoice with its lines and totals."""

    client_id = serializers.UUIDField(read_only=True)
    credited_invoice_id = serializers.UUIDField(read_only=True, allow_null=True)
    credited_invoice_number = serializers.CharField(
        source="credited_invoice.number", read_only=True, allow_null=True, default=None
    )
    credit_note_id = serializers.SerializerMethodField()
    credit_note_number = serializers.SerializerMethodField()
    client_display_name = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    lines = InvoiceLineSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    balance_due = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "kind",
            "number",
            "status",
            "is_overdue",
            "credited_invoice_id",
            "credited_invoice_number",
            "credit_note_id",
            "credit_note_number",
            "client_id",
            "client_display_name",
            "issue_date",
            "due_date",
            "currency",
            "notes",
            "subtotal",
            "tax_total",
            "total",
            "amount_paid",
            "balance_due",
            "lines",
            "payments",
            "seller_name",
            "seller_tax_id",
            "seller_trade_register",
            "seller_address",
            "client_name",
            "client_tax_id",
            "client_address",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def _credit_note(self, invoice):
        return getattr(invoice, "credit_note", None)

    def get_credit_note_id(self, invoice) -> str | None:
        note = self._credit_note(invoice)
        return str(note.id) if note else None

    def get_credit_note_number(self, invoice) -> str | None:
        note = self._credit_note(invoice)
        return note.number if note else None

    def get_client_display_name(self, invoice) -> str:
        # Issued: the frozen name. Draft: the client record as it is now.
        return invoice.client_name or invoice.client.name

    def get_is_overdue(self, invoice) -> bool:
        return (
            invoice.kind == Invoice.Kind.INVOICE
            and invoice.status == Invoice.Status.ISSUED
            and invoice.due_date is not None
            and invoice.due_date < timezone.localdate()
        )


class InvoiceWriteSerializer(serializers.Serializer):
    """Write side of a draft: client, due date, notes and the full list of lines."""

    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.none())
    due_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    lines = InvoiceLineSerializer(many=True)

    def get_fields(self):
        fields = super().get_fields()
        # Only the active company's clients can be invoiced: another company's
        # client id is rejected as "does not exist", like an unknown one.
        request = self.context.get("request")
        company = getattr(request, "company", None)
        fields["client"].queryset = Client.objects.filter(company=company)
        return fields


class TaxRateSerializer(serializers.Serializer):
    code = serializers.CharField()
    rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    label = serializers.CharField()


class PaymentMethodSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()


class InvoicingRulesSerializer(serializers.Serializer):
    country = serializers.CharField()
    currency = serializers.CharField()
    currency_decimals = serializers.IntegerField()
    default_tax_rate = serializers.CharField()
    tax_rates = TaxRateSerializer(many=True)
    payment_methods = PaymentMethodSerializer(many=True)


def _amount(**kwargs):
    return serializers.DecimalField(max_digits=18, decimal_places=2, **kwargs)


class ReceivableSerializer(serializers.Serializer):
    client_id = serializers.UUIDField()
    client_name = serializers.CharField()
    total_due = _amount()
    overdue_due = _amount()
    invoice_count = serializers.IntegerField()
    max_days_late = serializers.IntegerField()


class AgingSerializer(serializers.Serializer):
    not_due = _amount()
    days_1_30 = _amount()
    days_31_60 = _amount()
    days_61_90 = _amount()
    days_over_90 = _amount()


class ExpenseByCategorySerializer(serializers.Serializer):
    category = serializers.CharField()
    total = _amount()


class CashPositionSerializer(serializers.Serializer):
    balance = _amount()
    in_this_month = _amount()
    payments_this_month = _amount()
    out_this_month = _amount()
    expenses_this_month = ExpenseByCategorySerializer(many=True)
    alert_threshold = _amount(allow_null=True)
    below_threshold = serializers.BooleanField()
    has_entries = serializers.BooleanField()


class FinancialSummarySerializer(serializers.Serializer):
    currency = serializers.CharField()
    today = serializers.DateField()
    invoiced_this_year = _amount()
    invoiced_this_month = _amount()
    collected_this_year = _amount()
    collected_this_month = _amount()
    outstanding = _amount()
    overdue = _amount()
    open_count = serializers.IntegerField()
    overdue_count = serializers.IntegerField()
    draft_count = serializers.IntegerField()
    aging = AgingSerializer()
    receivables = ReceivableSerializer(many=True)
    receivables_count = serializers.IntegerField()
    cash = CashPositionSerializer()


class ClientFinancialsSerializer(serializers.Serializer):
    currency = serializers.CharField()
    invoiced = _amount()
    paid = _amount()
    due = _amount()
    overdue = _amount()
    invoice_count = serializers.IntegerField()
    paid_invoice_count = serializers.IntegerField()
    last_issue_date = serializers.DateField(allow_null=True)
    average_days_late = serializers.IntegerField(
        allow_null=True, help_text="Over paid invoices; null when none is paid yet."
    )
