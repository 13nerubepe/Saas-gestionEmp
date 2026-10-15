import pytest

from accounts.tests.factories import MembershipFactory
from agents.llm import LLMUnavailable
from agents.llm.fake import FakeProvider
from agents.models import Answer, Conversation, Query
from agents.prompts import LegalAnswer
from agents.services import ask_legal_question
from agents.tests.conftest import TRIAL_PERIOD, TRIAL_PERIOD_QUESTION

pytestmark = pytest.mark.usefixtures("legal_texts")


def fake_answer(monkeypatch, **fields):
    answer = LegalAnswer(**({"answer": "Six months at most.", "cited": [1]} | fields))
    monkeypatch.setattr(FakeProvider, "generate_json", lambda self, **kw: answer)


def test_answer_is_saved_with_its_sources(monkeypatch):
    fake_answer(monkeypatch)
    membership = MembershipFactory()

    answer = ask_legal_question(membership=membership, question=TRIAL_PERIOD_QUESTION)

    assert answer.text == "Six months at most."
    assert answer.found_sources
    assert [s.legal_reference.citation for s in answer.sources.all()] == [TRIAL_PERIOD["citation"]]
    conversation = answer.query.conversation
    assert (conversation.company, conversation.user) == (membership.company, membership.user)


def test_unknown_or_repeated_citations_are_ignored(monkeypatch):
    fake_answer(monkeypatch, cited=[1, 1, 0, 7])

    answer = ask_legal_question(membership=MembershipFactory(), question=TRIAL_PERIOD_QUESTION)

    assert answer.sources.count() == 1


def test_answer_citing_nothing_has_no_sources(monkeypatch):
    fake_answer(monkeypatch, answer="The passages do not cover this.", cited=[])

    answer = ask_legal_question(membership=MembershipFactory(), question=TRIAL_PERIOD_QUESTION)

    assert not answer.found_sources
    assert answer.sources.count() == 0
    assert answer.model_name == "fake"


def test_no_relevant_text_means_no_generation(monkeypatch):
    def must_not_be_called(self, **kwargs):
        raise AssertionError("the model must not answer without sources")

    monkeypatch.setattr(FakeProvider, "generate_json", must_not_be_called)

    answer = ask_legal_question(
        membership=MembershipFactory(), question="How do I register a trademark?"
    )

    assert not answer.found_sources
    assert answer.sources.count() == 0
    assert answer.text


def test_provider_failure_saves_nothing(monkeypatch):
    def fail(self, **kwargs):
        raise LLMUnavailable("timeout")

    monkeypatch.setattr(FakeProvider, "generate_json", fail)

    with pytest.raises(LLMUnavailable):
        ask_legal_question(membership=MembershipFactory(), question=TRIAL_PERIOD_QUESTION)

    assert not Conversation.objects.exists()
    assert not Query.objects.exists()
    assert not Answer.objects.exists()
