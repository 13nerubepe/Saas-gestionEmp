import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _fake_llm(settings):
    """No test ever calls a real model."""
    settings.LLM_PROVIDER = "fake"


@pytest.fixture(autouse=True)
def _clear_cache():
    """Rate-limit counters live in the cache: reset them between tests."""
    cache.clear()
    yield
    cache.clear()
