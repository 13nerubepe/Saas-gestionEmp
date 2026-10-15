from typing import Protocol, TypeVar

from pydantic import BaseModel

SchemaT = TypeVar("SchemaT", bound=BaseModel)


class LLMUnavailable(Exception):
    """The provider failed, timed out or returned something unusable."""


class LLMProvider(Protocol):
    """What the agents need from a language model, whatever the vendor.

    Business code depends on this interface only, so the vendor can change and
    tests can run on a fake.
    """

    model_name: str

    def embed(self, texts: list[str], *, for_query: bool) -> list[list[float]]:
        """One vector per text. `for_query` distinguishes a question from a stored passage."""
        ...

    def generate_json(self, *, system: str, prompt: str, schema: type[SchemaT]) -> SchemaT:
        """Generate an answer that validates against the pydantic `schema`."""
        ...
