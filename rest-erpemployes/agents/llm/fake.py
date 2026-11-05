import hashlib
import re
from typing import Literal, get_args, get_origin

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
        """A valid instance of any answer schema: text fields say "Fake <name>.",
        number lists cite passage 1, choices take their first value."""
        values = {}
        for name, field in schema.model_fields.items():
            annotation = field.annotation
            if get_origin(annotation) is list:
                values[name] = [1]
            elif get_origin(annotation) is Literal:
                values[name] = get_args(annotation)[0]
            elif annotation is str:
                values[name] = "Fake answer." if name == "answer" else f"Fake {name}."
        return schema(**values)

    def _embed_one(self, text):
        vector = [0.0] * settings.EMBEDDING_DIMENSIONS
        for word in re.findall(r"\w+", text.lower()):
            digest = hashlib.md5(word.encode(), usedforsecurity=False).digest()
            vector[int.from_bytes(digest[:4]) % len(vector)] += 1.0
        if not any(vector):
            vector[0] = 1.0  # A zero vector has no direction: cosine distance is undefined.
        return vector
