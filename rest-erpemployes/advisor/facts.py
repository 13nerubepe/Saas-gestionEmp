"""The facts the advisor may rely on, computed from the company's own data.

Every figure comes from the billing and crm selectors. The model receives the
facts numbered, cites the numbers it uses, and the service checks them, the
same way the legal agent cites legal passages. Facts are written in English;
the model answers in the user's language.

Text typed by users (client names, interaction notes) goes inside « » and is
truncated: the prompt tells the model it is data, never instructions.
"""

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from billing import selectors as billing
from billing.models import CashMovement, Invoice
from billing.rules import rules_for
from crm import selectors as crm
from crm.models import Client

# Caps keep the prompt short; the largest amounts and freshest leads come first.
MAX_DEBTORS = 15
MAX_OVERDUE_INVOICES = 10
MAX_TOP_CLIENTS = 5
MAX_PROSPECTS = 10
MAX_DORMANT = 10
DORMANT_AFTER_DAYS = 60
NOTE_LENGTH = 160

# Category codes in plain English for the model (labels shown to users are translated).
CATEGORY_LABELS = {
    CashMovement.Category.SUPPLIES: "supplies and goods",
    CashMovement.Category.RENT: "rent",
    CashMovement.Category.STAFF: "staff",
    CashMovement.Category.TRANSPORT: "transport",
    CashMovement.Category.UTILITIES: "water, power, phone, internet",
    CashMovement.Category.TAXES: "taxes and duties",
    CashMovement.Category.BANK_FEES: "bank and mobile money fees",
    CashMovement.Category.OWNER_WITHDRAWAL: "owner withdrawals",
    CashMovement.Category.OTHER: "other",
}


@dataclass(frozen=True)
class Fact:
    topic: str  # finance, debtor, overdue_invoice, crm, top_client, prospect, dormant_client
    text: str
    # What the screen can link to: ("client" | "invoice", uuid) or None.
    link_type: str = ""
    link_id: str = ""


class Money:
    """Formats amounts the same way in every fact: 70 000 XAF."""

    def __init__(self, company):
        rules = rules_for(company.country)
        self.currency = rules.currency if rules else company.currency
        self.decimals = rules.currency_decimals if rules else 2

    def __call__(self, amount):
        value = Decimal(amount).quantize(Decimal(1).scaleb(-self.decimals))
        return f"{value:,} {self.currency}".replace(",", " ")


def quoted(text, length=80):
    text = " ".join(str(text).split())
    if len(text) > length:
        text = text[: length - 1] + "…"
    return f"«{text}»"


def _days_ago(moment, today):
    day = moment.date() if hasattr(moment, "date") else moment
    return (today - day).days


def company_facts(company, *, today=None):
    """Everything the advisor knows about the company's money and clients."""
    today = today or timezone.localdate()
    money = Money(company)
    facts = []

    summary = billing.financial_summary(company, today=today)
    if summary["open_count"] or summary["invoiced_this_year"] or summary["draft_count"]:
        facts.append(
            Fact(
                "finance",
                f"Situation on {today.isoformat()}: invoiced this year "
                f"{money(summary['invoiced_this_year'])} (this month "
                f"{money(summary['invoiced_this_month'])}); collected this year "
                f"{money(summary['collected_this_year'])} (this month "
                f"{money(summary['collected_this_month'])}); still to collect "
                f"{money(summary['outstanding'])} on {summary['open_count']} open invoices, "
                f"of which {money(summary['overdue'])} overdue on "
                f"{summary['overdue_count']} invoices; {summary['draft_count']} draft "
                "invoices not issued yet.",
            )
        )
    if summary["outstanding"]:
        aging = summary["aging"]
        facts.append(
            Fact(
                "finance",
                "Unpaid amounts by lateness: not yet due "
                f"{money(aging['not_due'])}; 1-30 days late {money(aging['days_1_30'])}; "
                f"31-60 days late {money(aging['days_31_60'])}; 61-90 days late "
                f"{money(aging['days_61_90'])}; over 90 days late "
                f"{money(aging['days_over_90'])}.",
            )
        )

    cash = billing.cash_position(company, today=today)
    if cash["has_entries"]:
        alert = ""
        if cash["alert_threshold"] is not None:
            alert = f" The founder's alert threshold is {money(cash['alert_threshold'])}: the " + (
                "balance is BELOW it." if cash["below_threshold"] else "balance is above it."
            )
        facts.append(
            Fact(
                "cash",
                f"Cash position (payments received plus money in, minus money out, as "
                f"recorded): balance {money(cash['balance'])}. This month: money in "
                f"{money(cash['in_this_month'])} (of which invoice payments "
                f"{money(cash['payments_this_month'])}), money out "
                f"{money(cash['out_this_month'])}." + alert,
            )
        )
        if cash["expenses_this_month"]:
            spent = "; ".join(
                f"{CATEGORY_LABELS.get(row['category'], row['category'])} {money(row['total'])}"
                for row in cash["expenses_this_month"][:6]
            )
            facts.append(Fact("cash", f"Money out this month by category: {spent}."))

    for row in billing.receivables_by_client(company, today=today, limit=MAX_DEBTORS):
        client = Client.objects.get(pk=row["client_id"], company=company)
        account = billing.client_financials(client, today=today)
        late = (
            f"{money(row['overdue_due'])} overdue, oldest overdue invoice "
            f"{row['max_days_late']} days late"
            if row["overdue_due"]
            else "nothing overdue yet"
        )
        habit = (
            f"on average {account['average_days_late']} days late on paid invoices"
            if account["average_days_late"] is not None
            else "no fully paid invoice yet"
        )
        facts.append(
            Fact(
                "debtor",
                f"Client {quoted(row['client_name'])} owes {money(row['total_due'])} on "
                f"{row['invoice_count']} open invoices ({late}). Account since the first "
                f"invoice: invoiced {money(account['invoiced'])}, paid "
                f"{money(account['paid'])}; {habit}." + _last_contact(client, today),
                "client",
                str(client.id),
            )
        )

    for invoice in billing.overdue_invoices(company, today=today, limit=MAX_OVERDUE_INVOICES):
        facts.append(
            Fact(
                "overdue_invoice",
                f"Invoice {invoice.number} to {quoted(invoice.client.name)}: balance "
                f"{money(invoice.balance_due)} of {money(invoice.total)}, due "
                f"{invoice.due_date.isoformat()} ({(today - invoice.due_date).days} days late).",
                "invoice",
                str(invoice.id),
            )
        )

    counts = crm.status_counts(company)
    if any(counts.values()):
        facts.append(
            Fact(
                "crm",
                f"Client base: {counts['prospect']} prospects, {counts['active']} active "
                f"clients, {counts['inactive']} inactive clients.",
            )
        )

    year_start = today.replace(month=1, day=1)
    for row in billing.revenue_by_client(company, since=year_start, limit=MAX_TOP_CLIENTS):
        where = ", ".join(part for part in (row["client__city"], row["client__kind"]) if part)
        facts.append(
            Fact(
                "top_client",
                f"Top client this year: {quoted(row['client__name'])}"
                + (f" ({where})" if where else "")
                + f", invoiced {money(row['invoiced'])} on {row['invoice_count']} invoices.",
                "client",
                str(row["client_id"]),
            )
        )

    for prospect in crm.prospects_by_activity(company, limit=MAX_PROSPECTS):
        where = ", ".join(part for part in (prospect.city, prospect.kind) if part)
        facts.append(
            Fact(
                "prospect",
                f"Prospect {quoted(prospect.name)}"
                + (f" ({where})" if where else "")
                + f", on file for {_days_ago(prospect.created_at, today)} days, "
                f"{prospect.interaction_count} recorded interactions"
                + _last_interaction_text(prospect, today)
                + ".",
                "client",
                str(prospect.id),
            )
        )

    since = timezone.now() - timedelta(days=DORMANT_AFTER_DAYS)
    for client in crm.dormant_clients(company, since=since, limit=MAX_DORMANT):
        silence = (
            f"no interaction for {_days_ago(client.last_interaction_at, today)} days"
            if client.last_interaction_at
            else "no interaction ever recorded"
        )
        facts.append(
            Fact(
                "dormant_client",
                f"Active client {quoted(client.name)}: {silence}.",
                "client",
                str(client.id),
            )
        )
    return facts


def _last_interaction_text(client, today):
    if not client.last_interaction_at:
        return ", never contacted"
    return (
        f", last one {_days_ago(client.last_interaction_at, today)} days ago "
        f"({client.last_interaction_kind}: "
        f"{quoted(client.last_interaction_summary, NOTE_LENGTH)})"
    )


def _last_contact(client, today):
    last = client.interactions.order_by("-occurred_at").first()
    if last is None:
        return " No interaction recorded with this client."
    return (
        f" Last interaction {_days_ago(last.occurred_at, today)} days ago "
        f"({last.kind}: {quoted(last.summary, NOTE_LENGTH)})."
    )


def invoice_facts(invoice, *, today=None):
    """What a payment reminder may mention about one invoice."""
    today = today or timezone.localdate()
    company, client = invoice.company, invoice.client
    money = Money(company)
    rules = rules_for(company.country)
    late = (today - invoice.due_date).days if invoice.due_date else 0
    facts = [
        Fact(
            "invoice",
            f"Invoice {invoice.number} issued on {invoice.issue_date.isoformat()} by "
            f"{quoted(company.name)} to {quoted(client.name)}"
            + (f", contact person {quoted(client.contact_name)}" if client.contact_name else "")
            + f". Total {money(invoice.total)}, already paid {money(invoice.amount_paid)}, "
            f"balance due {money(invoice.balance_due)}. Due date "
            f"{invoice.due_date.isoformat()}"
            + (f", {late} days late." if late > 0 else ", not late yet."),
            "invoice",
            str(invoice.id),
        )
    ]
    if rules:
        methods = ", ".join(str(m.label) for m in rules.payment_methods if m.code != "other")
        facts.append(Fact("payment_methods", f"Accepted payment methods: {methods}."))
    history = list(client.interactions.order_by("-occurred_at")[:3])
    for interaction in history:
        facts.append(
            Fact(
                "interaction",
                f"Interaction {_days_ago(interaction.occurred_at, today)} days ago "
                f"({interaction.kind}): {quoted(interaction.summary, NOTE_LENGTH)}.",
                "client",
                str(client.id),
            )
        )
    other_open = (
        Invoice.objects.filter(
            client=client, kind=Invoice.Kind.INVOICE, status=Invoice.Status.ISSUED
        )
        .exclude(pk=invoice.pk)
        .count()
    )
    if other_open:
        facts.append(Fact("invoice", f"The client has {other_open} other unpaid invoices."))
    return facts
