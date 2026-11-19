"""Reads over invoices and payments: lists, who owes what, financial summary.

Every figure the founder or the advisor agent sees is computed here, in the
database, never by a language model.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Case, Count, DecimalField, F, Max, Min, Q, Sum, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone

from billing.models import CashMovement, Invoice, Payment

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
            kind=Invoice.Kind.INVOICE,
            status=Invoice.Status.ISSUED,
            due_date__lt=today or timezone.localdate(),
        )
    return queryset.select_related("client").order_by("-created_at", "id")


def invoices_only(company):
    """The company's invoices, without credit notes: credit notes owe nothing
    and their invoice is cancelled, so neither counts in what is invoiced."""
    return Invoice.objects.filter(company=company, kind=Invoice.Kind.INVOICE)


def open_invoices(company):
    """Issued and not fully paid: what clients still owe."""
    return invoices_only(company).filter(status=Invoice.Status.ISSUED)


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
    billed = invoices_only(company).filter(status__in=[Invoice.Status.ISSUED, Invoice.Status.PAID])

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
        "draft_count": invoices_only(company).filter(status=Invoice.Status.DRAFT).count(),
        "aging": {name: open_totals[name] for name, _low, _high in AGING_BUCKETS},
    }


def client_financials(client, *, today=None):
    """One client's account: invoiced, paid, owed, overdue, and how late they pay."""
    today = today or timezone.localdate()
    invoices = invoices_only(client.company).filter(
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
        invoices_only(company)
        .filter(
            status__in=[Invoice.Status.ISSUED, Invoice.Status.PAID],
            issue_date__gte=since,
        )
        .values("client_id", "client__name", "client__city", "client__kind")
        .annotate(invoiced=_sum(F("total")), invoice_count=Count("id"))
        .order_by("-invoiced", "client__name")
    )
    return list(rows[:limit] if limit else rows)


def cash_position(company, *, today=None):
    """Cash in hand: payments received plus money in, minus money out.

    Reversals are negative rows, so plain sums stay right. `below_threshold`
    is true when the company set an alert threshold and the balance is under it.
    """
    today = today or timezone.localdate()
    month_start = today.replace(day=1)
    payments = Payment.objects.filter(company=company).aggregate(
        total=_sum(F("amount")), month=_sum(F("amount"), paid_on__gte=month_start)
    )
    movements = CashMovement.objects.filter(company=company)
    moves = movements.aggregate(
        total_in=_sum(F("amount"), direction=CashMovement.Direction.IN),
        total_out=_sum(F("amount"), direction=CashMovement.Direction.OUT),
        month_in=_sum(
            F("amount"), direction=CashMovement.Direction.IN, occurred_on__gte=month_start
        ),
        month_out=_sum(
            F("amount"), direction=CashMovement.Direction.OUT, occurred_on__gte=month_start
        ),
    )
    expenses = (
        movements.filter(direction=CashMovement.Direction.OUT, occurred_on__gte=month_start)
        .values("category")
        .annotate(total=_sum(F("amount")))
        .filter(total__gt=0)
        .order_by("-total")
    )
    balance = payments["total"] + moves["total_in"] - moves["total_out"]
    threshold = company.cash_alert_threshold
    return {
        "balance": balance,
        "in_this_month": payments["month"] + moves["month_in"],
        "payments_this_month": payments["month"],
        "out_this_month": moves["month_out"],
        "expenses_this_month": [
            {"category": row["category"], "total": row["total"]} for row in expenses
        ],
        "alert_threshold": threshold,
        "below_threshold": threshold is not None and balance < threshold,
        "has_entries": movements.exists() or payments["total"] != 0,
    }


FORECAST_HORIZONS = (30, 60, 90)
OUTFLOW_HISTORY_DAYS = 90


def cash_forecast(company, *, today=None):
    """US-17: cash in 30, 60 and 90 days, under stated assumptions.

    - Cautious: current balance + open invoices not yet overdue, received on
      their due date − the average money out of the last 90 days, spread
      evenly. Overdue invoices are not counted: nobody knows when they come.
    - If overdue invoices are paid: the cautious figure + what is overdue.
    - Risk date: the first day the cautious balance falls under the alert
      threshold (under zero when no threshold is set).
    Money in that is not an invoice (sales without invoice, contributions)
    is not forecast. The average is taken over at least 30 days.
    """
    today = today or timezone.localdate()
    balance = cash_position(company, today=today)["balance"]
    open_ = open_invoices(company)
    overdue = open_.filter(due_date__lt=today).aggregate(total=_sum(BALANCE))["total"]
    expected = {
        row["due_date"]: row["total"]
        for row in open_.filter(due_date__gte=today)
        .values("due_date")
        .annotate(total=_sum(BALANCE))
    }

    since = today - timedelta(days=OUTFLOW_HISTORY_DAYS)
    movements = CashMovement.objects.filter(company=company)
    spent = movements.filter(
        direction=CashMovement.Direction.OUT, occurred_on__gte=since, occurred_on__lt=today
    ).aggregate(total=_sum(F("amount")))["total"]
    first = movements.filter(direction=CashMovement.Direction.OUT).aggregate(
        first=Min("occurred_on")
    )["first"]
    # Average over the history we have, up to 90 days, but never under a
    # month: rent paid three days ago is a monthly expense, not a daily one.
    history_days = min(OUTFLOW_HISTORY_DAYS, (today - first).days) if first else 0
    daily_out = spent / max(history_days, 30) if history_days > 0 else Decimal(0)

    threshold = company.cash_alert_threshold
    floor = threshold if threshold is not None else Decimal(0)
    risk_date = None
    running = balance
    horizons = []
    for day in range(0, max(FORECAST_HORIZONS) + 1):
        date_ = today + timedelta(days=day)
        running += expected.get(date_, Decimal(0))
        cautious = running - daily_out * day
        if risk_date is None and cautious < floor:
            risk_date = date_
        if day in FORECAST_HORIZONS:
            cautious = cautious.quantize(Decimal(1))
            horizons.append(
                {
                    "days": day,
                    "date": date_,
                    "cautious": cautious,
                    "if_overdue_paid": cautious + overdue,
                }
            )
    return {
        "today": today,
        "balance": balance,
        "overdue": overdue,
        "monthly_outflow": (daily_out * 30).quantize(Decimal(1)),
        "outflow_history_days": history_days,
        "horizons": horizons,
        "threshold": threshold,
        "risk_date": risk_date,
    }
