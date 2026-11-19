"""US-17: cash forecast at 30, 60 and 90 days."""

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

TODAY = date(2026, 11, 19)


@pytest.fixture
def company():
    return MembershipFactory(company__country="CM", company__tax_id="M0123").company


def move(company, direction, category, amount, days_ago):
    services.record_cash_movement(
        company=company,
        direction=direction,
        category=category,
        amount=Decimal(amount),
        occurred_on=TODAY - timedelta(days=days_ago),
        method="cash",
        label="x",
        user=None,
    )


def invoice(company, amount, due_in):
    client = Client.objects.create(company=company, name=f"Client {amount}")
    line = {
        "description": "x",
        "quantity": Decimal(1),
        "unit_price": Decimal(amount),
        "tax_rate_code": "exempt",
    }
    draft = services.create_invoice(
        company=company, client=client, lines=[line], due_date=TODAY + timedelta(days=due_in)
    )
    return services.issue_invoice(draft, today=TODAY - timedelta(days=40))


@pytest.fixture
def books(company, monkeypatch):
    # The cash balance and the "not in the future" checks use the real date:
    # pin it to TODAY.
    monkeypatch.setattr("django.utils.timezone.localdate", lambda *a, **k: TODAY)
    move(company, "in", "opening_balance", 100000, 60)
    move(company, "out", "rent", 90000, 30)  # 30 days of history: 3 000 a day
    invoice(company, 50000, 10)  # expected in 10 days
    invoice(company, 20000, -5)  # overdue
    return company


def test_cautious_and_optimistic_horizons(books):
    forecast = selectors.cash_forecast(books, today=TODAY)

    assert forecast["balance"] == 10000
    # Books start 60 days ago (opening balance): 90 000 out over 60 days.
    assert (forecast["outflow_history_days"], forecast["outflow_basis_days"]) == (60, 60)
    assert forecast["monthly_outflow"] == 45000
    assert forecast["overdue"] == 20000
    assert [(h["days"], h["cautious"], h["if_overdue_paid"]) for h in forecast["horizons"]] == [
        (30, 15000, 35000),  # 10 000 + 50 000 − 30 × 1 500
        (60, -30000, -10000),
        (90, -75000, -55000),
    ]
    # No threshold: the risk is going under zero, on day 7 (10 000 − 7 × 1 500).
    assert forecast["risk_date"] == TODAY + timedelta(days=7)


def test_month_ends(books):
    ends = selectors.cash_forecast(books, today=TODAY)["month_ends"]
    assert [e["date"] for e in ends] == [date(2026, 11, 30), date(2026, 12, 31), date(2027, 1, 31)]
    # 30 November is day 11: the 50 000 due on day 10 is in.
    assert ends[0]["cautious"] == 10000 + 50000 - 11 * 1500


def test_risk_against_the_threshold(books):
    books.cash_alert_threshold = Decimal(5000)
    books.save()
    assert selectors.cash_forecast(books, today=TODAY)["risk_date"] == TODAY + timedelta(days=4)


def test_reversed_entries_are_left_out(books):
    wrong = services.record_cash_movement(
        company=books,
        direction="out",
        category="supplies",
        amount=Decimal(300000),
        occurred_on=TODAY - timedelta(days=20),
        method="cash",
        label="erreur",
        user=None,
    )
    services.reverse_cash_movement(wrong, reason="saisi deux fois", user=None)
    assert selectors.cash_forecast(books, today=TODAY)["monthly_outflow"] == 45000


def test_invoice_due_today_counts_and_cancelled_ones_do_not(books):
    due_today = invoice(books, 7000, 0)
    cancelled = invoice(books, 99000, 5)
    services.create_credit_note(cancelled, reason="annulée")
    forecast = selectors.cash_forecast(books, today=TODAY)
    assert forecast["horizons"][0]["cautious"] == 15000 + 7000
    assert due_today.balance_due == 7000


def test_a_short_history_is_averaged_over_a_month(company, monkeypatch):
    monkeypatch.setattr("django.utils.timezone.localdate", lambda *a, **k: TODAY)
    move(company, "in", "opening_balance", 500000, 10)
    move(company, "out", "rent", 150000, 3)  # rent paid 3 days ago
    forecast = selectors.cash_forecast(company, today=TODAY)
    assert (forecast["outflow_history_days"], forecast["outflow_basis_days"]) == (10, 30)
    assert forecast["monthly_outflow"] == 150000  # not 150 000 / 3 days × 30
    assert forecast["horizons"][0]["cautious"] == 200000  # 350 000 − 150 000


def test_without_history_nothing_is_spent(company, monkeypatch):
    monkeypatch.setattr("django.utils.timezone.localdate", lambda *a, **k: TODAY)
    move(company, "in", "opening_balance", 10000, 1)
    invoice(company, 5000, 3)
    forecast = selectors.cash_forecast(company, today=TODAY)
    assert forecast["monthly_outflow"] == 0
    assert forecast["horizons"][0]["cautious"] == 15000
    assert forecast["risk_date"] is None


def api_for(membership):
    api = APIClient()
    api.force_authenticate(membership.user)
    api.credentials(
        **{f"HTTP_{COMPANY_HEADER.upper().replace('-', '_')}": str(membership.company.id)}
    )
    return api


def test_forecast_endpoint_is_founder_only(books):
    founder = books.memberships.get()
    response = api_for(founder).get("/api/v1/billing/forecast/")
    assert response.status_code == 200
    assert response.data["currency"] == "XAF"
    assert [h["days"] for h in response.data["horizons"]] == [30, 60, 90]
    employee = MembershipFactory(company=books, role=Membership.Role.EMPLOYEE)
    assert api_for(employee).get("/api/v1/billing/forecast/").status_code == 403
    assert (
        api_for(MembershipFactory(company__country="CM"))
        .get("/api/v1/billing/forecast/")
        .data["balance"]
        == "0.00"
    )
