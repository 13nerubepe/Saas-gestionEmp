from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from accounts.models import Membership
from accounts.tenancy import COMPANY_HEADER
from accounts.tests.factories import MembershipFactory
from billing import selectors, services
from crm.models import Client

pytestmark = pytest.mark.django_db

TODAY = date(2026, 11, 5)


@pytest.fixture
def company():
    return MembershipFactory(company__country="CM", company__tax_id="M0123").company


def issued(company, client, amount, *, issued_on, due_in_days):
    """An issued invoice of `amount` before tax, exempt so totals stay round."""
    line = {
        "description": "Service",
        "quantity": Decimal(1),
        "unit_price": Decimal(amount),
        "tax_rate_code": "exempt",
    }
    invoice = services.create_invoice(
        company=company, client=client, lines=[line], due_date=issued_on + timedelta(due_in_days)
    )
    return services.issue_invoice(invoice, today=issued_on)


def pay(invoice, amount, paid_on):
    return services.record_payment(
        invoice, amount=Decimal(amount), paid_on=paid_on, method="cash", user=None
    )


@pytest.fixture
def books(company):
    """Three clients: one late payer, one up to date, one fully paid."""
    late = Client.objects.create(company=company, name="Late SARL")
    fine = Client.objects.create(company=company, name="Fine SA")
    paid = Client.objects.create(company=company, name="Paid Ltd")
    # Late: 100 000 due 45 days ago (half paid), 20 000 due 5 days ago.
    a = issued(company, late, 100000, issued_on=TODAY - timedelta(75), due_in_days=30)
    pay(a, 50000, TODAY - timedelta(20))
    issued(company, late, 20000, issued_on=TODAY - timedelta(35), due_in_days=30)
    # Fine: 30 000 due in 10 days.
    issued(company, fine, 30000, issued_on=TODAY - timedelta(20), due_in_days=30)
    # Paid: 40 000 issued this month, paid 3 days after its due date.
    c = issued(company, paid, 40000, issued_on=TODAY - timedelta(4), due_in_days=0)
    pay(c, 40000, TODAY - timedelta(1))
    return {"late": late, "fine": fine, "paid": paid}


def test_who_owes_what(company, books):
    rows = selectors.receivables_by_client(company, today=TODAY)

    assert [r["client_name"] for r in rows] == ["Late SARL", "Fine SA"]
    late, fine = rows
    assert (late["total_due"], late["overdue_due"], late["invoice_count"]) == (70000, 70000, 2)
    assert late["max_days_late"] == 45
    assert (fine["total_due"], fine["overdue_due"], fine["max_days_late"]) == (30000, 0, 0)


def test_financial_summary(company, books):
    summary = selectors.financial_summary(company, today=TODAY)

    assert summary["invoiced_this_year"] == 190000
    assert summary["invoiced_this_month"] == 40000
    assert summary["collected_this_year"] == 90000
    assert summary["collected_this_month"] == 40000
    assert summary["outstanding"] == 100000
    assert (summary["overdue"], summary["overdue_count"], summary["open_count"]) == (70000, 2, 3)
    assert summary["aging"] == {
        "not_due": 30000,
        "days_1_30": 20000,
        "days_31_60": 50000,
        "days_61_90": 0,
        "days_over_90": 0,
    }


def test_client_financials(company, books):
    late = selectors.client_financials(books["late"], today=TODAY)
    assert (late["invoiced"], late["paid"], late["due"], late["overdue"]) == (
        120000,
        50000,
        70000,
        70000,
    )
    assert late["average_days_late"] is None  # nothing fully paid yet

    paid = selectors.client_financials(books["paid"], today=TODAY)
    assert (paid["due"], paid["paid_invoice_count"], paid["average_days_late"]) == (0, 1, 3)


def test_drafts_and_other_companies_never_count(company, books):
    services.create_invoice(
        company=company,
        client=books["fine"],
        lines=[{"description": "x", "quantity": Decimal(1), "unit_price": Decimal(999)}],
    )
    other = MembershipFactory(company__country="CM", company__tax_id="X").company
    issued(
        other,
        Client.objects.create(company=other, name="Elsewhere"),
        5000,
        issued_on=TODAY,
        due_in_days=0,
    )

    summary = selectors.financial_summary(company, today=TODAY)
    assert summary["outstanding"] == 100000
    assert summary["draft_count"] == 1
    assert len(selectors.receivables_by_client(company, today=TODAY)) == 2


# API


def api_for(membership):
    api = APIClient()
    api.force_authenticate(membership.user)
    api.credentials(
        **{f"HTTP_{COMPANY_HEADER.upper().replace('-', '_')}": str(membership.company.id)}
    )
    return api


def test_summary_and_client_financials_endpoints(company, books):
    founder = company.memberships.get()
    summary = api_for(founder).get("/api/v1/billing/summary/")
    assert summary.status_code == 200
    assert summary.data["currency"] == "XAF"
    assert summary.data["receivables_count"] == 2
    assert summary.data["receivables"][0]["client_name"] == "Late SARL"

    url = f"/api/v1/billing/clients/{books['late'].id}/financials/"
    financials = api_for(founder).get(url)
    assert financials.status_code == 200
    assert financials.data["due"] == "70000.00"


def test_summary_endpoints_are_founder_only_and_scoped(company, books):
    employee = MembershipFactory(company=company, role=Membership.Role.EMPLOYEE)
    intruder = MembershipFactory(company__country="CM")
    url = f"/api/v1/billing/clients/{books['late'].id}/financials/"

    assert api_for(employee).get("/api/v1/billing/summary/").status_code == 403
    assert api_for(employee).get(url).status_code == 403
    assert api_for(intruder).get(url).status_code == 404
    assert api_for(intruder).get("/api/v1/billing/summary/").data["outstanding"] == "0.00"
