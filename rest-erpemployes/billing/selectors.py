from django.utils import timezone

from billing.models import Invoice


def filter_invoices(queryset, *, status=None, client_id=None, overdue=False, today=None):
    """Invoices by status or client; `overdue` keeps issued ones past their due date."""
    if status:
        queryset = queryset.filter(status=status)
    if client_id:
        queryset = queryset.filter(client_id=client_id)
    if overdue:
        queryset = queryset.filter(
            status=Invoice.Status.ISSUED, due_date__lt=today or timezone.localdate()
        )
    return queryset.select_related("client").order_by("-created_at", "id")
