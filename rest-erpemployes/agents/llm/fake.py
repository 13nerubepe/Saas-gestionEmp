import hashlib
import re

from django.conf import settings

from agents.llm.base import SchemaT


class FakeProvider:
    """Deterministic stand-in for tests: no network, no cost.

    Embeddings are bags of words hashed into the vector, so texts sharing words
    are close and texts with no word in common are orthogonal. That is enough to
    test retrieval with hand-written passages.
    """

    model_name = "fake"

    def embed(self, texts, *, for_query):
        return [self._embed_one(text) for text in texts]

    def generate_json(self, *, system, prompt, schema: type[SchemaT]) -> SchemaT:
        return schema(answer="Fake answer.", cited=[1])

    def _embed_one(self, text):
        vector = [0.0] * settings.EMBEDDING_DIMENSIONS
        for word in re.findall(r"\w+", text.lower()):
            digest = hashlib.md5(word.encode(), usedforsecurity=False).digest()
            vector[int.from_bytes(digest[:4]) % len(vector)] += 1.0
        if not any(vector):
            vector[0] = 1.0  # A zero vector has no direction: cosine distance is undefined.
        return vector
