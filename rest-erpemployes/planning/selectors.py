"""US-06 "Ma journée": what to do today, read from the other apps.

No model and no copy: every block comes from the same selectors as the
screens it links to, so the amounts are always the same everywhere.
"""

from django.utils import timezone

from accounts.models import Membership
from billing import selectors as billing
from billing.rules import rules_for
from crm import selectors as crm
from crm.models import FollowUp

MAX_ITEMS = 8


def my_day(membership, *, today=None):
    """Blocks of "Ma journée" for this member. Employees get no financial data."""
    today = today or timezone.localdate()
    company = membership.company
    due = crm.follow_ups(FollowUp.objects.filter(company=company), due="today", today=today)
    day = {
        "today": today,
        "follow_ups": list(due[:MAX_ITEMS]),
        "follow_up_count": due.count(),
        "overdue_invoices": None,
        "overdue_invoice_count": None,
        "overdue_total": None,
        "alerts": None,
        "currency": None,
    }
    if membership.role != Membership.Role.FOUNDER:
        return day

    summary = billing.financial_summary(company, today=today)
    cash = billing.cash_position(company, today=today)
    alerts = []
    if cash["below_threshold"]:
        alerts.append(
            {
                "code": "cash_below_threshold",
                "amount": cash["balance"],
                "threshold": cash["alert_threshold"],
            }
        )
    if summary["draft_count"]:
        alerts.append({"code": "draft_invoices", "count": summary["draft_count"]})

    invoices = billing.overdue_invoices(company, today=today)
    day.update(
        {
            "overdue_invoices": [
                {
                    "id": invoice.id,
                    "number": invoice.number,
                    "client_id": invoice.client_id,
                    "client_name": invoice.client.name,
                    "balance_due": invoice.balance_due,
                    "due_date": invoice.due_date,
                    "days_late": (today - invoice.due_date).days,
                }
                for invoice in invoices[:MAX_ITEMS]
            ],
            "overdue_invoice_count": len(invoices),
            "overdue_total": summary["overdue"],
            "alerts": alerts,
            "currency": _currency(company),
        }
    )
    return day


def _currency(company):
    rules = rules_for(company.country)
    return rules.currency if rules else company.currency
