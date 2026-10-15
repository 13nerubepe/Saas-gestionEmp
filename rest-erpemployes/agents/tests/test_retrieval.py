import pytest

from agents.jurisdictions import applicable_jurisdictions
from agents.llm.fake import FakeProvider
from agents.selectors import search_legal_references
from agents.services import load_legal_references
from agents.tests.conftest import TRIAL_PERIOD, TRIAL_PERIOD_QUESTION


def question_vector(text=TRIAL_PERIOD_QUESTION):
    return FakeProvider().embed([text], for_query=True)[0]


def test_cameroon_gets_its_own_law_then_regional_law():
    assert applicable_jurisdictions("CM") == ["CM", "CEMAC", "OHADA"]
    assert applicable_jurisdictions("SN") == ["SN", "OHADA"]
    assert applicable_jurisdictions("FR") == ["FR"]


@pytest.mark.usefixtures("legal_texts")
def test_search_returns_closest_passage_first():
    results = search_legal_references(
        embedding=question_vector(), jurisdictions=["CM", "OHADA"], max_distance=1.0
    )

    assert [ref.citation for ref in results][0] == TRIAL_PERIOD["citation"]
    assert results[0].distance < results[1].distance


@pytest.mark.usefixtures("legal_texts")
def test_search_drops_unrelated_passages():
    results = search_legal_references(embedding=question_vector(), jurisdictions=["CM", "OHADA"])

    assert [ref.citation for ref in results] == [TRIAL_PERIOD["citation"]]


@pytest.mark.usefixtures("legal_texts")
def test_search_ignores_other_jurisdictions():
    results = search_legal_references(embedding=question_vector(), jurisdictions=["SN", "OHADA"])

    assert results == []


@pytest.mark.django_db
def test_loader_only_reembeds_changed_passages(monkeypatch):
    calls = []
    original = FakeProvider.embed
    monkeypatch.setattr(
        FakeProvider,
        "embed",
        lambda self, texts, **kw: calls.append(len(texts)) or original(self, texts, **kw),
    )

    assert load_legal_references([TRIAL_PERIOD]) == (1, 0, 1)
    assert load_legal_references([TRIAL_PERIOD]) == (0, 1, 0)
    assert load_legal_references([TRIAL_PERIOD | {"content": "New wording."}]) == (0, 1, 1)
    assert calls == [1, 1]
