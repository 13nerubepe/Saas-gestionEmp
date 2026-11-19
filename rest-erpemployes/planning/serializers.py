from rest_framework import serializers

from crm.serializers import FollowUpSerializer


def _amount(**kwargs):
    return serializers.DecimalField(max_digits=18, decimal_places=2, **kwargs)


class OverdueInvoiceSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    number = serializers.CharField()
    client_id = serializers.UUIDField()
    client_name = serializers.CharField()
    balance_due = _amount()
    due_date = serializers.DateField()
    days_late = serializers.IntegerField()


class AlertSerializer(serializers.Serializer):
    """A stable `code` the client translates, plus the figures it needs."""

    code = serializers.ChoiceField(
        choices=["cash_below_threshold", "cash_forecast_risk", "draft_invoices"]
    )
    amount = _amount(required=False)
    threshold = _amount(required=False)
    count = serializers.IntegerField(required=False)
    date = serializers.DateField(required=False)


class MyDaySerializer(serializers.Serializer):
    """Financial blocks are null for employees: they see their follow-ups only."""

    today = serializers.DateField()
    follow_ups = FollowUpSerializer(many=True)
    follow_up_count = serializers.IntegerField()
    overdue_invoices = OverdueInvoiceSerializer(many=True, allow_null=True)
    overdue_invoice_count = serializers.IntegerField(allow_null=True)
    overdue_total = _amount(allow_null=True)
    alerts = AlertSerializer(many=True, allow_null=True)
    currency = serializers.CharField(allow_null=True)
