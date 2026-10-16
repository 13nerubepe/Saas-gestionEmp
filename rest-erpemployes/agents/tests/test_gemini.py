"""GeminiProvider without network: the SDK call is replaced by a stub."""

import pytest
from google.genai import errors

from agents.llm import LLMUnavailable
from agents.llm.gemini import GeminiProvider
from agents.prompts import LegalAnswer

OVERLOADED = errors.ServerError(503, {"error": {"code": 503, "message": "high demand"}})


class Response:
    text = '{"answer": "Six months.", "cited": [1]}'


@pytest.fixture
def provider(settings, monkeypatch):
    settings.GEMINI_API_KEY = "test-key"
    settings.GEMINI_MODEL = "main-model"
    settings.GEMINI_FALLBACK_MODEL = "fallback-model"
    provider = GeminiProvider()
    calls = []

    def stub(outcomes):
        def generate_content(*, model, contents, config):
            calls.append(model)
            outcome = outcomes[model]
            if isinstance(outcome, Exception):
                raise outcome
            return outcome

        monkeypatch.setattr(provider.client.models, "generate_content", generate_content)

    provider.stub, provider.calls = stub, calls
    return provider


def ask(provider):
    return provider.generate_json(system="s", prompt="p", schema=LegalAnswer)


def test_main_model_answers(provider):
    provider.stub({"main-model": Response()})

    assert ask(provider).cited == [1]
    assert provider.calls == ["main-model"]
    assert provider.model_name == "main-model"


def test_falls_back_when_main_model_is_overloaded(provider):
    provider.stub({"main-model": OVERLOADED, "fallback-model": Response()})

    assert ask(provider).answer == "Six months."
    assert provider.calls == ["main-model", "fallback-model"]
    assert provider.model_name == "fallback-model"


def test_falls_back_when_main_model_is_out_of_quota(provider):
    quota = errors.ClientError(429, {"error": {"code": 429, "message": "quota exceeded"}})
    provider.stub({"main-model": quota, "fallback-model": Response()})

    assert ask(provider).answer == "Six months."
    assert provider.model_name == "fallback-model"


def test_unavailable_when_every_model_is_overloaded(provider):
    provider.stub({"main-model": OVERLOADED, "fallback-model": OVERLOADED})

    with pytest.raises(LLMUnavailable):
        ask(provider)


def test_client_errors_do_not_fall_back(provider):
    denied = errors.ClientError(403, {"error": {"code": 403, "message": "denied"}})
    provider.stub({"main-model": denied, "fallback-model": Response()})

    with pytest.raises(LLMUnavailable):
        ask(provider)
    assert provider.calls == ["main-model"]
