import pytest

from agents.services import load_legal_references

# Passages with distinct vocabularies, so the fake bag-of-words embeddings put
# a trial-period question close to the first one and far from the others.
TRIAL_PERIOD = {
    "jurisdiction": "CM",
    "citation": "Labour code, art. 28",
    "title": "Trial period",
    "content": "The trial period of an employment contract may not exceed six months.",
}
COMMERCIAL_LEASE = {
    "jurisdiction": "OHADA",
    "citation": "Uniform act on general commercial law, art. 123",
    "title": "Lease renewal",
    "content": "A tenant operating a business may claim renewal of a commercial lease.",
}
TRIAL_PERIOD_QUESTION = "What is the maximum trial period of an employment contract?"


@pytest.fixture(autouse=True)
def _search_threshold(settings):
    # The fake embeddings are cruder than Gemini's: allow a wider distance.
    settings.LEGAL_SEARCH_MAX_DISTANCE = 0.7


@pytest.fixture
def legal_texts(db):
    load_legal_references([TRIAL_PERIOD, COMMERCIAL_LEASE])
