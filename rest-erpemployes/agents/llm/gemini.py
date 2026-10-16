import time

import httpx
import pydantic
from django.conf import settings
from google import genai
from google.genai import errors, types

from agents.llm.base import LLMUnavailable, SchemaT

# Gemini accepts at most 100 texts per embedding request, and the free tier
# counts every text against a 100-per-minute quota: send 90 at a time and
# wait between batches (GEMINI_EMBED_BATCH_PAUSE_SECONDS, 0 on a paid plan).
EMBED_BATCH_SIZE = 90

# One retry on rate limiting and transient overload ("high demand"). Kept low:
# the user waits for the answer, and each attempt can last LLM_TIMEOUT_SECONDS.
RETRY_OPTIONS = types.HttpRetryOptions(attempts=2, http_status_codes=[429, 500, 503])


class GeminiProvider:
    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise LLMUnavailable("GEMINI_API_KEY is not set.")
        self.model_name = settings.GEMINI_MODEL
        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=types.HttpOptions(
                timeout=settings.LLM_TIMEOUT_SECONDS * 1000, retry_options=RETRY_OPTIONS
            ),
        )

    def embed(self, texts, *, for_query):
        config = types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY" if for_query else "RETRIEVAL_DOCUMENT",
            output_dimensionality=settings.EMBEDDING_DIMENSIONS,
        )
        vectors = []
        for start in range(0, len(texts), EMBED_BATCH_SIZE):
            if start:
                time.sleep(settings.GEMINI_EMBED_BATCH_PAUSE_SECONDS)
            batch = texts[start : start + EMBED_BATCH_SIZE]
            try:
                result = self.client.models.embed_content(
                    model=settings.GEMINI_EMBEDDING_MODEL, contents=batch, config=config
                )
            except (errors.APIError, httpx.HTTPError) as exc:
                raise LLMUnavailable(str(exc)) from exc
            vectors.extend(embedding.values for embedding in result.embeddings)
        return vectors

    def generate_json(self, *, system, prompt, schema: type[SchemaT]) -> SchemaT:
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.2,
        )
        models = [settings.GEMINI_MODEL, *settings.GEMINI_FALLBACK_MODELS]
        for model in dict.fromkeys(filter(None, models)):
            try:
                response = self.client.models.generate_content(
                    model=model, contents=prompt, config=config
                )
                result = schema.model_validate_json(response.text or "")
            except errors.APIError as exc:
                # Overloaded (5xx) or out of quota (429, counted per model):
                # try the next model. Other errors would fail the same way.
                if exc.code != 429 and not isinstance(exc, errors.ServerError):
                    raise LLMUnavailable(str(exc)) from exc
                last_error = exc
                continue
            except (httpx.HTTPError, pydantic.ValidationError) as exc:
                raise LLMUnavailable(str(exc)) from exc
            # Record the model that actually answered.
            self.model_name = model
            return result
        raise LLMUnavailable(str(last_error)) from last_error
