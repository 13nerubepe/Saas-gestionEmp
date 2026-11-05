import pytest
from rest_framework.test import APIClient

from accounts.models import Membership
from accounts.tenancy import COMPANY_HEADER
from accounts.tests.factories import MembershipFactory
from billing.models import Invoice
from crm.models import Client

pytestmark = pytest.mark.django_db

INVOICES_URL = "/api/v1/billing/invoices/"


def api_for(membership):
    api = APIClient()
    api.force_authenticate(membership.user)
    api.credentials(
        **{f"HTTP_{COMPANY_HEADER.upper().replace('-', '_')}": str(membership.company.id)}
    )
    return api


@pytest.fixture
def founder():
    membership = MembershipFactory(company__country="CM", company__tax_id="M0123")
    return membership


@pytest.fixture
def acme(founder):
    return Client.objects.create(company=founder.company, name="Acme SARL")


def payload(client, **extra):
    return {
        "client": str(client.id),
        "due_date": "2026-12-05",
        "lines": [{"description": "Conseil", "quantity": "2", "unit_price": "50000"}],
        **extra,
    }


def test_create_draft_then_issue(founder, acme):
    api = api_for(founder)

    created = api.post(INVOICES_URL, payload(acme), format="json")
    assert created.status_code == 201, created.data
    assert created.data["status"] == "draft"
    assert created.data["number"] == ""
    assert created.data["currency"] == "XAF"
    assert created.data["total"] == "119250.00"
    assert created.data["client_display_name"] == "Acme SARL"
    assert Invoice.objects.get().company == founder.company

    issued = api.post(f"{INVOICES_URL}{created.data['id']}/issue/")
    assert issued.status_code == 200
    assert issued.data["status"] == "issued"
    assert issued.data["number"].startswith("FAC-")


def test_update_and_delete_draft(founder, acme):
    api = api_for(founder)
    invoice_id = api.post(INVOICES_URL, payload(acme), format="json").data["id"]

    updated = api.put(
        f"{INVOICES_URL}{invoice_id}/",
        payload(
            acme,
            lines=[
                {
                    "description": "Formation",
                    "quantity": "1",
                    "unit_price": "1000",
                    "tax_rate_code": "exempt",
                }
            ],
        ),
        format="json",
    )
    assert updated.status_code == 200
    assert updated.data["total"] == "1000.00"

    assert api.delete(f"{INVOICES_URL}{invoice_id}/").status_code == 204
    assert not Invoice.objects.exists()


def test_issued_invoice_is_frozen(founder, acme):
    api = api_for(founder)
    invoice_id = api.post(INVOICES_URL, payload(acme), format="json").data["id"]
    api.post(f"{INVOICES_URL}{invoice_id}/issue/")

    response = api.put(f"{INVOICES_URL}{invoice_id}/", payload(acme), format="json")
    assert response.status_code == 409
    assert response.data["code"] == "invoice_not_draft"
    assert api.delete(f"{INVOICES_URL}{invoice_id}/").status_code == 409
    assert api.patch(f"{INVOICES_URL}{invoice_id}/", {}, format="json").status_code == 405


def test_issue_errors_carry_a_code(founder, acme):
    api = api_for(founder)
    empty = api.post(INVOICES_URL, payload(acme, lines=[]), format="json").data["id"]
    assert api.post(f"{INVOICES_URL}{empty}/issue/").data["code"] == "invoice_empty"

    founder.company.tax_id = ""
    founder.company.save()
    draft = api.post(INVOICES_URL, payload(acme), format="json").data["id"]
    assert api.post(f"{INVOICES_URL}{draft}/issue/").data["code"] == "seller_details_missing"


def test_invalid_lines_are_rejected(founder, acme):
    api = api_for(founder)
    bad = [
        {"description": "x", "quantity": "0", "unit_price": "10"},
        {"description": "x", "quantity": "1", "unit_price": "-1"},
        {"description": "x", "quantity": "1", "unit_price": "10", "tax_rate_code": "zero"},
    ]
    for line in bad:
        response = api.post(INVOICES_URL, payload(acme, lines=[line]), format="json")
        assert response.status_code == 400, line
    assert not Invoice.objects.exists()


def test_list_filters(founder, acme):
    api = api_for(founder)
    draft = api.post(INVOICES_URL, payload(acme), format="json").data["id"]
    past_due = api.post(INVOICES_URL, payload(acme, due_date="2020-01-01"), format="json").data[
        "id"
    ]
    api.post(f"{INVOICES_URL}{past_due}/issue/")

    ids = lambda response: {row["id"] for row in response.data["results"]}  # noqa: E731
    assert ids(api.get(INVOICES_URL)) == {draft, past_due}
    assert ids(api.get(INVOICES_URL, {"status": "draft"})) == {draft}
    overdue = api.get(INVOICES_URL, {"overdue": "true"})
    assert ids(overdue) == {past_due}
    assert overdue.data["results"][0]["is_overdue"] is True


def test_rules_endpoint(founder):
    response = api_for(founder).get("/api/v1/billing/rules/")
    assert response.status_code == 200
    assert response.data["currency"] == "XAF"
    assert response.data["currency_decimals"] == 0
    assert {rate["code"] for rate in response.data["tax_rates"]} == {"standard", "exempt"}


# Tenant isolation and roles


def test_another_company_never_sees_or_touches_the_invoice(founder, acme):
    invoice_id = api_for(founder).post(INVOICES_URL, payload(acme), format="json").data["id"]
    intruder = api_for(MembershipFactory(company__country="CM"))

    assert intruder.get(INVOICES_URL).data["count"] == 0
    for call in (
        lambda: intruder.get(f"{INVOICES_URL}{invoice_id}/"),
        lambda: intruder.put(f"{INVOICES_URL}{invoice_id}/", payload(acme), format="json"),
        lambda: intruder.delete(f"{INVOICES_URL}{invoice_id}/"),
        lambda: intruder.post(f"{INVOICES_URL}{invoice_id}/issue/"),
    ):
        assert call().status_code == 404


def test_cannot_invoice_another_company_client(founder):
    foreign_client = Client.objects.create(company=MembershipFactory().company, name="Foreign")
    response = api_for(founder).post(INVOICES_URL, payload(foreign_client), format="json")
    assert response.status_code == 400
    assert "client" in response.data


def test_employees_and_anonymous_cannot_invoice(founder, acme):
    employee = MembershipFactory(company=founder.company, role=Membership.Role.EMPLOYEE)
    assert api_for(employee).get(INVOICES_URL).status_code == 403
    assert api_for(employee).post(INVOICES_URL, payload(acme), format="json").status_code == 403
    assert APIClient().get(INVOICES_URL).status_code == 401
