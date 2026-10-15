from django.conf import settings

from agents.llm.base import LLMProvider, LLMUnavailable


def get_provider() -> LLMProvider:
    """The provider selected by settings.LLM_PROVIDER."""
    if settings.LLM_PROVIDER == "fake":
        from agents.llm.fake import FakeProvider

        return FakeProvider()
    if settings.LLM_PROVIDER == "gemini":
        from agents.llm.gemini import GeminiProvider

        return GeminiProvider()
    raise ValueError(f"Unknown LLM_PROVIDER: {settings.LLM_PROVIDER!r}")


__all__ = ["LLMProvider", "LLMUnavailable", "get_provider"]
