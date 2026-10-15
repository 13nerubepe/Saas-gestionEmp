import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import Membership
from accounts.tenancy import COMPANY_HEADER
from accounts.tests.factories import MembershipFactory
from agents.llm import LLMUnavailable
from agents.llm.fake import FakeProvider
from agents.models import Conversation
from agents.serializers import LEGAL_DISCLAIMER
from agents.tests.conftest import TRIAL_PERIOD, TRIAL_PERIOD_QUESTION

pytestmark = pytest.mark.usefixtures("legal_texts")

ASK_URL = "/api/v1/agents/legal/questions/"


def client_for(membership):
    client = APIClient()
    client.force_authenticate(membership.user)
    client.credentials(
        **{f"HTTP_{COMPANY_HEADER.upper().replace('-', '_')}": str(membership.company.id)}
    )
    return client


def ask(client, question=TRIAL_PERIOD_QUESTION, **extra):
    return client.post(ASK_URL, {"question": question, **extra}, format="json")


@pytest.fixture
def founder():
    return MembershipFactory()


def test_founder_gets_an_answer_with_sources_and_disclaimer(founder):
    founder.user.language = "en"
    founder.user.save()

    response = ask(client_for(founder))

    assert response.status_code == 201
    assert response.data["found_sources"] is True
    assert response.data["sources"][0]["citation"] == TRIAL_PERIOD["citation"]
    assert response.data["disclaimer"] == LEGAL_DISCLAIMER


def test_disclaimer_follows_the_user_language(founder):
    response = ask(client_for(founder))

    assert founder.user.language == "fr"
    assert response.data["disclaimer"].startswith("Cette réponse")


def test_anonymous_is_rejected():
    assert ask(APIClient()).status_code == 401


def test_employee_cannot_ask():
    employee = MembershipFactory(role=Membership.Role.EMPLOYEE)

    assert ask(client_for(employee)).status_code == 403


def test_provider_failure_returns_503_with_code(founder, monkeypatch):
    def fail(self, **kwargs):
        raise LLMUnavailable("down")

    monkeypatch.setattr(FakeProvider, "generate_json", fail)

    response = ask(client_for(founder))

    assert response.status_code == 503
    assert response.data["code"] == "llm_unavailable"


def test_questions_can_continue_a_conversation(founder):
    client = client_for(founder)
    first = ask(client)

    second = ask(client, conversation_id=first.data["conversation_id"])
    detail = client.get(reverse("conversation-detail", args=[first.data["conversation_id"]]))

    assert second.data["conversation_id"] == first.data["conversation_id"]
    assert len(detail.data["exchanges"]) == 2


def test_cannot_continue_someone_elses_conversation(founder):
    other = MembershipFactory(company=founder.company, role=Membership.Role.FOUNDER)
    conversation_id = ask(client_for(other)).data["conversation_id"]

    response = ask(client_for(founder), conversation_id=conversation_id)

    assert response.status_code == 404


def test_conversations_are_private_to_user_and_company(founder):
    ask(client_for(founder))
    ask(client_for(MembershipFactory()))  # another company
    ask(client_for(MembershipFactory(company=founder.company)))  # same company, other user

    response = client_for(founder).get(reverse("conversation-list"))

    assert response.data["count"] == 1
    mine = Conversation.objects.get(user=founder.user)
    assert response.data["results"][0]["id"] == str(mine.id)


def test_other_company_conversation_is_not_found(founder):
    other_id = ask(client_for(MembershipFactory())).data["conversation_id"]

    response = client_for(founder).get(reverse("conversation-detail", args=[other_id]))

    assert response.status_code == 404
    assert response.data["code"] == "not_found"
