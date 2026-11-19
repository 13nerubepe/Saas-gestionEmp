"""US-06: "Ma journée"."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Membership
from accounts.tenancy import COMPANY_HEADER
from accounts.tests.factories import MembershipFactory
from billing import selectors as billing_selectors
from billing import services as billing
from crm import services as crm
from crm.models import Client, FollowUp

pytestmark = pytest.mark.django_db

TODAY = timezone.localdate()
URL = "/api/v1/planning/my-day/"


def api_for(membership):
    api = APIClient()
    api.force_authenticate(membership.user)
    api.credentials(
        **{f"HTTP_{COMPANY_HEADER.upper().replace('-', '_')}": str(membership.company.id)}
    )
    return api


@pytest.fixture
def founder():
    return MembershipFactory(company__country="CM", company__tax_id="M0123")


@pytest.fixture
def day(founder):
    """A late follow-up, one for today, one for later, an overdue invoice, a draft."""
    company = founder.company
    hotel = Client.objects.create(company=company, name="Hôtel", status="active")
    late = crm.plan_follow_up(client=hotel, user=None, due_date=TODAY, reason="En retard")
    FollowUp.objects.filter(pk=late.pk).update(due_date=TODAY - timedelta(days=2))
    crm.plan_follow_up(client=hotel, user=None, due_date=TODAY, reason="Aujourd'hui")
    crm.plan_follow_up(
        client=hotel, user=None, due_date=TODAY + timedelta(days=3), reason="Plus tard"
    )
    line = {
        "description": "x",
        "quantity": Decimal(1),
        "unit_price": Decimal(100000),
        "tax_rate_code": "exempt",
    }
    invoice = billing.create_invoice(
        company=company, client=hotel, lines=[line], due_date=TODAY - timedelta(days=12)
    )
    billing.issue_invoice(invoice, today=TODAY - timedelta(days=40))
    billing.create_invoice(company=company, client=hotel, lines=[line])
    return company


def test_founder_sees_everything_to_do_today(founder, day):
    data = api_for(founder).get(URL).data

    assert [f["reason"] for f in data["follow_ups"]] == ["En retard", "Aujourd'hui"]
    assert data["follow_up_count"] == 2
    [invoice] = data["overdue_invoices"]
    assert (invoice["client_name"], invoice["balance_due"], invoice["days_late"]) == (
        "Hôtel",
        "100000.00",
        12,
    )
    assert data["overdue_total"] == "100000.00"
    assert data["currency"] == "XAF"
    assert {"code": "draft_invoices", "count": 1} in data["alerts"]


def test_amounts_match_the_other_screens(founder, day):
    data = api_for(founder).get(URL).data
    summary = billing_selectors.financial_summary(founder.company)
    assert Decimal(data["overdue_total"]) == summary["overdue"]
    assert data["overdue_invoice_count"] == summary["overdue_count"]


def test_cash_alert(founder, day):
    founder.company.cash_alert_threshold = Decimal(1000)
    founder.company.save()
    alerts = api_for(founder).get(URL).data["alerts"]
    assert alerts[0]["code"] == "cash_below_threshold"
    assert alerts[0]["threshold"] == "1000.00"


def test_nothing_to_do(founder):
    data = api_for(founder).get(URL).data
    assert (data["follow_ups"], data["overdue_invoices"], data["alerts"]) == ([], [], [])


def test_employee_sees_follow_ups_but_no_money(founder, day):
    employee = MembershipFactory(company=founder.company, role=Membership.Role.EMPLOYEE)
    data = api_for(employee).get(URL).data
    assert data["follow_up_count"] == 2
    assert (data["overdue_invoices"], data["overdue_total"], data["alerts"]) == (None, None, None)


def test_scoped_to_the_active_company(founder, day):
    data = api_for(MembershipFactory(company__country="CM")).get(URL).data
    assert (data["follow_up_count"], data["overdue_invoices"]) == (0, [])
    assert APIClient().get(URL).status_code == 401
