"""Reads over invoices and payments: lists, who owes what, financial summary.

Every figure the founder or the advisor agent sees is computed here, in the
database, never by a language model.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Case, Count, DecimalField, F, Max, Min, Q, Sum, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone

from billing.models import Invoice, Payment

ZERO = Value(Decimal(0), output_field=DecimalField(max_digits=18, decimal_places=2))
BALANCE = F("total") - F("amount_paid")

# Days past the due date, in buckets, for the aging of unpaid invoices.
AGING_BUCKETS = (
    ("not_due", None, 0),
    ("days_1_30", 1, 30),
    ("days_31_60", 31, 60),
    ("days_61_90", 61, 90),
    ("days_over_90", 91, None),
)


def _sum(expression, **filters):
    if filters:
        expression = Case(When(Q(**filters), then=expression), default=ZERO)
    return Coalesce(Sum(expression), ZERO)


def filter_invoices(queryset, *, status=None, client_id=None, overdue=False, today=None):
    """Invoices by status or client; `overdue` keeps unpaid ones past their due date."""
    if status:
        queryset = queryset.filter(status=status)
    if client_id:
        queryset = queryset.filter(client_id=client_id)
    if overdue:
        queryset = queryset.filter(
            status=Invoice.Status.ISSUED, due_date__lt=today or timezone.localdate()
        )
    return queryset.select_related("client").order_by("-created_at", "id")


def open_invoices(company):
    """Issued and not fully paid: what clients still owe."""
    return Invoice.objects.filter(company=company, status=Invoice.Status.ISSUED)


def receivables_by_client(company, *, today=None, limit=None):
    """Who owes money, largest balance first.

    One row per client: total due, part overdue, number of open invoices and
    days late of the oldest overdue one (0 when nothing is overdue).
    """
    today = today or timezone.localdate()
    rows = (
        open_invoices(company)
        .values("client_id", "client__name")
        .annotate(
            total_due=_sum(BALANCE),
            overdue_due=_sum(BALANCE, due_date__lt=today),
            invoice_count=Count("id"),
            oldest_due_date=Min("due_date"),
        )
        .order_by("-total_due", "client__name")
    )
    if limit:
        rows = rows[:limit]
    return [
        {
            "client_id": row["client_id"],
            "client_name": row["client__name"],
            "total_due": row["total_due"],
            "overdue_due": row["overdue_due"],
            "invoice_count": row["invoice_count"],
            "max_days_late": max(0, (today - row["oldest_due_date"]).days),
        }
        for row in rows
    ]


def overdue_invoices(company, *, today=None, limit=None):
    today = today or timezone.localdate()
    invoices = (
        open_invoices(company)
        .filter(due_date__lt=today)
        .select_related("client")
        .order_by("due_date", "number")
    )
    return list(invoices[:limit] if limit else invoices)


def financial_summary(company, *, today=None):
    """The company's invoicing at a glance: invoiced, collected, owed, overdue, aging."""
    today = today or timezone.localdate()
    year_start, month_start = date(today.year, 1, 1), today.replace(day=1)
    billed = Invoice.objects.filter(
        company=company, status__in=[Invoice.Status.ISSUED, Invoice.Status.PAID]
    )

    invoiced = billed.aggregate(
        year=_sum(F("total"), issue_date__gte=year_start),
        month=_sum(F("total"), issue_date__gte=month_start),
    )
    collected = Payment.objects.filter(company=company).aggregate(
        year=_sum(F("amount"), paid_on__gte=year_start),
        month=_sum(F("amount"), paid_on__gte=month_start),
    )
    aging_filters = {}
    for name, low, high in AGING_BUCKETS:
        if low is None:  # not due yet
            aging_filters[name] = _sum(BALANCE, due_date__gte=today)
            continue
        bounds = {"due_date__lte": today - timedelta(days=low)}
        if high is not None:
            bounds["due_date__gte"] = today - timedelta(days=high)
        aging_filters[name] = _sum(BALANCE, **bounds)
    open_totals = open_invoices(company).aggregate(
        outstanding=_sum(BALANCE),
        overdue=_sum(BALANCE, due_date__lt=today),
        open_count=Count("id"),
        overdue_count=Count("id", filter=Q(due_date__lt=today)),
        **aging_filters,
    )
    return {
        "today": today,
        "invoiced_this_year": invoiced["year"],
        "invoiced_this_month": invoiced["month"],
        "collected_this_year": collected["year"],
        "collected_this_month": collected["month"],
        "outstanding": open_totals["outstanding"],
        "overdue": open_totals["overdue"],
        "open_count": open_totals["open_count"],
        "overdue_count": open_totals["overdue_count"],
        "draft_count": Invoice.objects.filter(company=company, status=Invoice.Status.DRAFT).count(),
        "aging": {name: open_totals[name] for name, _low, _high in AGING_BUCKETS},
    }


def client_financials(client, *, today=None):
    """One client's account: invoiced, paid, owed, overdue, and how late they pay."""
    today = today or timezone.localdate()
    invoices = Invoice.objects.filter(
        client=client, status__in=[Invoice.Status.ISSUED, Invoice.Status.PAID]
    )
    totals = invoices.aggregate(
        invoiced=_sum(F("total")),
        paid=_sum(F("amount_paid")),
        due=_sum(BALANCE, status=Invoice.Status.ISSUED),
        overdue=_sum(BALANCE, status=Invoice.Status.ISSUED, due_date__lt=today),
        invoice_count=Count("id"),
        last_issue_date=Max("issue_date"),
    )
    # Payment behaviour: days between due date and last payment of paid invoices.
    delays = [
        (row["last_paid_on"] - row["due_date"]).days
        for row in invoices.filter(status=Invoice.Status.PAID)
        .annotate(last_paid_on=Max("payments__paid_on"))
        .values("due_date", "last_paid_on")
        if row["due_date"] and row["last_paid_on"]
    ]
    return {
        **totals,
        "paid_invoice_count": len(delays),
        "average_days_late": round(sum(max(0, d) for d in delays) / len(delays))
        if delays
        else None,
    }


def revenue_by_client(company, *, since, limit=None):
    """Clients by amount invoiced since `since` (a date), largest first."""
    rows = (
        Invoice.objects.filter(
            company=company,
            status__in=[Invoice.Status.ISSUED, Invoice.Status.PAID],
            issue_date__gte=since,
        )
        .values("client_id", "client__name", "client__city", "client__kind")
        .annotate(invoiced=_sum(F("total")), invoice_count=Count("id"))
        .order_by("-invoiced", "client__name")
    )
    return list(rows[:limit] if limit else rows)
