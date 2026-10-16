from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Membership
from accounts.tenancy import COMPANY_HEADER
from accounts.tests.factories import MembershipFactory
from crm.models import Client, Interaction

pytestmark = pytest.mark.django_db

CLIENTS_URL = "/api/v1/crm/clients/"


def client_for(membership):
    api = APIClient()
    api.force_authenticate(membership.user)
    api.credentials(
        **{f"HTTP_{COMPANY_HEADER.upper().replace('-', '_')}": str(membership.company.id)}
    )
    return api


def interactions_url(client_id):
    return reverse("client-interactions", args=[client_id])


@pytest.fixture
def founder():
    return MembershipFactory()


@pytest.fixture
def acme(founder):
    return Client.objects.create(company=founder.company, name="Acme SARL", email="contact@acme.cm")


# US-03: client records


def test_create_client_attaches_it_to_the_active_company(founder):
    other_company = MembershipFactory().company

    response = client_for(founder).post(
        CLIENTS_URL,
        {
            "name": "Acme SARL",
            "phone": "+237 6 99 00 00 00",
            "country": "cm",
            "company": str(other_company.id),
        },
        format="json",
    )

    assert response.status_code == 201
    created = Client.objects.get(pk=response.data["id"])
    assert created.company == founder.company
    assert created.country == "CM"
    assert response.data["interaction_count"] == 0


def test_name_is_required(founder):
    response = client_for(founder).post(CLIENTS_URL, {"email": "x@example.com"}, format="json")

    assert response.status_code == 400
    assert "name" in response.data


def test_list_is_scoped_to_the_company_and_searchable(founder, acme):
    Client.objects.create(company=founder.company, name="Globex", contact_name="Awa Diallo")
    Client.objects.create(company=MembershipFactory().company, name="Acme elsewhere")
    api = client_for(founder)

    everything = api.get(CLIENTS_URL)
    by_contact = api.get(CLIENTS_URL, {"search": "awa"})

    assert [c["name"] for c in everything.data["results"]] == ["Acme SARL", "Globex"]
    assert [c["name"] for c in by_contact.data["results"]] == ["Globex"]


def test_update_and_delete_client(founder, acme):
    api = client_for(founder)

    updated = api.patch(f"{CLIENTS_URL}{acme.id}/", {"status": "active"}, format="json")
    deleted = api.delete(f"{CLIENTS_URL}{acme.id}/")

    assert updated.data["status"] == "active"
    assert deleted.status_code == 204
    assert not Client.objects.exists()


def test_other_company_client_is_not_found(acme):
    outsider = MembershipFactory()
    api = client_for(outsider)

    assert api.get(f"{CLIENTS_URL}{acme.id}/").status_code == 404
    assert (
        api.patch(f"{CLIENTS_URL}{acme.id}/", {"name": "Hacked"}, format="json").status_code == 404
    )
    assert api.get(interactions_url(acme.id)).status_code == 404


def test_employees_can_work_on_clients(founder, acme):
    employee = MembershipFactory(company=founder.company, role=Membership.Role.EMPLOYEE)

    assert client_for(employee).get(CLIENTS_URL).data["count"] == 1


def test_anonymous_is_rejected():
    assert APIClient().get(CLIENTS_URL).status_code == 401


# US-04: interactions


def test_record_interactions_and_read_history_newest_first(founder, acme):
    api = client_for(founder)
    now = timezone.now()

    first = api.post(
        interactions_url(acme.id),
        {
            "kind": "call",
            "occurred_at": (now - timedelta(days=2)).isoformat(),
            "summary": "First call.",
        },
        format="json",
    )
    api.post(
        interactions_url(acme.id),
        {"kind": "meeting", "occurred_at": now.isoformat(), "summary": "Quote presented."},
        format="json",
    )
    history = api.get(interactions_url(acme.id))
    listed = api.get(CLIENTS_URL)

    assert first.status_code == 201
    assert first.data["created_by_email"] == founder.user.email
    assert [i["summary"] for i in history.data["results"]] == ["Quote presented.", "First call."]
    assert listed.data["results"][0]["interaction_count"] == 2
    assert listed.data["results"][0]["last_interaction_at"] is not None


def test_interaction_needs_kind_date_and_summary(founder, acme):
    response = client_for(founder).post(interactions_url(acme.id), {}, format="json")

    assert response.status_code == 400
    assert {"kind", "occurred_at", "summary"} <= set(response.data)


def test_interactions_cannot_be_edited_or_deleted(founder, acme):
    api = client_for(founder)

    assert api.put(interactions_url(acme.id), {}, format="json").status_code == 405
    assert api.delete(interactions_url(acme.id)).status_code == 405
    assert Interaction.objects.count() == 0
