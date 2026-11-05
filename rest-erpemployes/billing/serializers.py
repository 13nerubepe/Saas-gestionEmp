from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from billing.models import Invoice, InvoiceLine
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


class InvoiceSerializer(serializers.ModelSerializer):
    """Read side: an invoice with its lines and totals."""

    client_id = serializers.UUIDField(read_only=True)
    client_display_name = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    lines = InvoiceLineSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "number",
            "status",
            "is_overdue",
            "client_id",
            "client_display_name",
            "issue_date",
            "due_date",
            "currency",
            "notes",
            "subtotal",
            "tax_total",
            "total",
            "lines",
            "seller_name",
            "seller_tax_id",
            "client_name",
            "client_tax_id",
            "client_address",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_client_display_name(self, invoice) -> str:
        # Issued: the frozen name. Draft: the client record as it is now.
        return invoice.client_name or invoice.client.name

    def get_is_overdue(self, invoice) -> bool:
        return (
            invoice.status == Invoice.Status.ISSUED
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


class InvoicingRulesSerializer(serializers.Serializer):
    country = serializers.CharField()
    currency = serializers.CharField()
    currency_decimals = serializers.IntegerField()
    default_tax_rate = serializers.CharField()
    tax_rates = TaxRateSerializer(many=True)
