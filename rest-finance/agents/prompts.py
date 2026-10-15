"""Prompts are code: change PROMPT_VERSION whenever a prompt changes, so each
stored Answer says which prompt produced it."""

from pydantic import BaseModel

PROMPT_VERSION = "legal-v1"

LANGUAGE_NAMES = {"fr": "French", "en": "English"}

LEGAL_SYSTEM_PROMPT = """\
You are the legal assistant of a back-office application for entrepreneurs in Africa.

Rules:
- Answer ONLY from the numbered legal passages given in the request. Never use
  outside knowledge, never invent an article, a number or a deadline.
- If the passages do not answer the question, say so plainly instead of guessing.
- Be concise and practical: the reader is an entrepreneur, not a lawyer.
- Mention the article you rely on in the text, and list the numbers of every
  passage you used in `cited`.
- Do not add a disclaimer: the application adds its own.
- Write the answer in {language}.
"""


class LegalAnswer(BaseModel):
    answer: str
    cited: list[int]


def build_legal_system_prompt(language):
    return LEGAL_SYSTEM_PROMPT.format(language=LANGUAGE_NAMES.get(language, "French"))


def build_legal_prompt(question, references):
    passages = "\n\n".join(
        f"[{number}] ({ref.jurisdiction}) {ref.citation}"
        + (f" — {ref.title}" if ref.title else "")
        + f"\n{ref.content}"
        for number, ref in enumerate(references, start=1)
    )
    return f"Legal passages:\n\n{passages}\n\nQuestion:\n{question}"
