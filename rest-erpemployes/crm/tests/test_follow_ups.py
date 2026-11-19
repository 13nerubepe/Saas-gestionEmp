"""US-05: dated follow-ups."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Membership
from accounts.tenancy import COMPANY_HEADER
from accounts.tests.factories import MembershipFactory
from crm import services
from crm.models import Client, FollowUp, Interaction

pytestmark = pytest.mark.django_db

TODAY = timezone.localdate()


def api_for(membership):
    api = APIClient()
    api.force_authenticate(membership.user)
    api.credentials(
        **{f"HTTP_{COMPANY_HEADER.upper().replace('-', '_')}": str(membership.company.id)}
    )
    return api


@pytest.fixture
def founder():
    return MembershipFactory()


@pytest.fixture
def acme(founder):
    return Client.objects.create(company=founder.company, name="Acme SARL", status="prospect")


def plan(client, days, reason="Envoyer le devis", channel="call", user=None):
    return services.plan_follow_up(
        client=client,
        user=user,
        due_date=TODAY + timedelta(days=days),
        reason=reason,
        channel=channel,
    )


def make_overdue(follow_up, days=3):
    FollowUp.objects.filter(pk=follow_up.pk).update(due_date=TODAY - timedelta(days=days))
    follow_up.refresh_from_db()
    return follow_up


# Services


def test_a_follow_up_cannot_be_planned_in_the_past(acme):
    with pytest.raises(services.serializers.ValidationError):
        plan(acme, -1)
    assert plan(acme, 0).due_date == TODAY  # today is fine


def test_completing_adds_the_summary_to_the_client_history(founder, acme):
    follow_up = plan(acme, 2, channel="whatsapp")
    done = services.complete_follow_up(follow_up, user=founder.user, summary="Devis accepté")

    assert (done.status, done.done_at is not None) == ("done", True)
    interaction = Interaction.objects.get(client=acme)
    assert interaction == done.outcome
    assert interaction.kind == "message"  # WhatsApp is recorded as a message
    assert interaction.summary == "Envoyer le devis — Devis accepté"
    with pytest.raises(services.FollowUpClosed):
        services.complete_follow_up(done, user=founder.user, summary="Encore")


def test_postponing_keeps_the_earlier_dates(acme):
    follow_up = plan(acme, 1)
    moved = services.postpone_follow_up(follow_up, due_date=TODAY + timedelta(days=5))

    assert moved.due_date == TODAY + timedelta(days=5)
    assert [(p["from"], p["to"]) for p in moved.postponements] == [
        ((TODAY + timedelta(days=1)).isoformat(), (TODAY + timedelta(days=5)).isoformat())
    ]
    with pytest.raises(services.serializers.ValidationError):
        services.postpone_follow_up(moved, due_date=TODAY - timedelta(days=1))


# API


def test_plan_and_list_a_client_follow_ups(founder, acme):
    api = api_for(founder)
    url = f"/api/v1/crm/clients/{acme.id}/follow-ups/"
    created = api.post(
        url,
        {"due_date": str(TODAY + timedelta(days=3)), "reason": "Rappeler", "channel": "call"},
        format="json",
    )
    assert created.status_code == 201, created.data
    assert (created.data["status"], created.data["is_overdue"]) == ("open", False)

    past = api.post(url, {"due_date": str(TODAY - timedelta(days=1)), "reason": "x"}, format="json")
    assert past.status_code == 400
    assert api.get(url).data["count"] == 1

    clients = api.get("/api/v1/crm/clients/").data["results"]
    assert clients[0]["next_follow_up_date"] == str(TODAY + timedelta(days=3))


def test_due_filters_for_my_day(founder, acme):
    late = make_overdue(plan(acme, 0, reason="En retard"))
    today = plan(acme, 0, reason="Aujourd'hui")
    later = plan(acme, 4, reason="Plus tard")
    services.complete_follow_up(plan(acme, 0, reason="Fait"), user=None, summary="ok")

    api = api_for(founder)

    def reasons(due):
        rows = api.get("/api/v1/crm/follow-ups/", {"due": due}).data["results"]
        return [r["reason"] for r in rows]

    assert reasons("today") == ["En retard", "Aujourd'hui"]
    assert reasons("overdue") == ["En retard"]
    assert reasons("upcoming") == ["Plus tard"]
    assert reasons("done") == ["Fait"]
    row = api.get(f"/api/v1/crm/clients/{acme.id}/follow-ups/", {"due": "overdue"}).data["results"][
        0
    ]
    assert (row["id"], row["is_overdue"]) == (str(late.id), True)
    assert {str(today.id), str(later.id)} <= {
        r["id"] for r in api.get("/api/v1/crm/follow-ups/").data["results"]
    }


def test_complete_and_postpone_through_the_api(founder, acme):
    api = api_for(founder)
    follow_up = plan(acme, 1)
    moved = api.post(
        f"/api/v1/crm/follow-ups/{follow_up.id}/postpone/",
        {"due_date": str(TODAY + timedelta(days=7))},
        format="json",
    )
    assert moved.status_code == 200
    assert len(moved.data["postponements"]) == 1

    done = api.post(
        f"/api/v1/crm/follow-ups/{follow_up.id}/complete/", {"summary": "Signé"}, format="json"
    )
    assert done.status_code == 200
    assert done.data["outcome_summary"] == "Envoyer le devis — Signé"
    again = api.post(
        f"/api/v1/crm/follow-ups/{follow_up.id}/complete/", {"summary": "x" * 3}, format="json"
    )
    assert (again.status_code, again.data["code"]) == (409, "follow_up_closed")


def test_follow_ups_are_scoped_and_open_to_employees(founder, acme):
    follow_up = plan(acme, 1)
    intruder = api_for(MembershipFactory())
    employee = api_for(MembershipFactory(company=founder.company, role=Membership.Role.EMPLOYEE))

    assert intruder.get("/api/v1/crm/follow-ups/").data["count"] == 0
    assert intruder.get(f"/api/v1/crm/clients/{acme.id}/follow-ups/").status_code == 404
    assert (
        intruder.post(
            f"/api/v1/crm/follow-ups/{follow_up.id}/complete/", {"summary": "pirate"}, format="json"
        ).status_code
        == 404
    )
    assert (
        intruder.post(
            f"/api/v1/crm/follow-ups/{follow_up.id}/postpone/",
            {"due_date": str(TODAY)},
            format="json",
        ).status_code
        == 404
    )

    done = employee.post(
        f"/api/v1/crm/follow-ups/{follow_up.id}/complete/", {"summary": "Rappelé"}, format="json"
    )
    assert done.status_code == 200
    assert APIClient().get("/api/v1/crm/follow-ups/").status_code == 401
