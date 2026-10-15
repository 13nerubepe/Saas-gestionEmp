import hashlib

from django.db import transaction
from django.utils import translation
from django.utils.translation import gettext as _

from agents.jurisdictions import applicable_jurisdictions
from agents.llm import get_provider
from agents.models import Answer, Conversation, LegalReference, Query, Source
from agents.prompts import (
    PROMPT_VERSION,
    LegalAnswer,
    build_legal_prompt,
    build_legal_system_prompt,
)
from agents.selectors import search_legal_references


def ask_legal_question(*, membership, question, conversation=None):
    """Answer a legal question from the texts applicable to the company.

    Every model call happens before anything is written, so a provider failure
    (LLMUnavailable) leaves no half-saved question behind.
    """
    user, company = membership.user, membership.company
    language = user.language
    provider = get_provider()

    [embedding] = provider.embed([question], for_query=True)
    references = search_legal_references(
        embedding=embedding, jurisdictions=applicable_jurisdictions(company.country)
    )

    if references:
        result = provider.generate_json(
            system=build_legal_system_prompt(language),
            prompt=build_legal_prompt(question, references),
            schema=LegalAnswer,
        )
        text = result.answer
        # Keep only numbers that point to a passage we actually sent, once each.
        cited = [
            references[number - 1]
            for number in dict.fromkeys(result.cited)
            if 1 <= number <= len(references)
        ]
    else:
        # Nothing relevant: do not let the model improvise without sources.
        with translation.override(language):
            text = _(
                "No applicable legal text was found for this question. "
                "Consult a legal professional before deciding."
            )
        cited = []

    with transaction.atomic():
        if conversation is None:
            conversation = Conversation.objects.create(
                company=company, user=user, title=question[:255]
            )
        query = Query.objects.create(conversation=conversation, text=question, language=language)
        answer = Answer.objects.create(
            query=query,
            text=text,
            # Passages may be retrieved yet judged irrelevant by the model.
            found_sources=bool(cited),
            model_name=provider.model_name if references else "",
            prompt_version=PROMPT_VERSION if references else "",
        )
        Source.objects.bulk_create(
            Source(answer=answer, legal_reference=ref, rank=rank, distance=ref.distance)
            for rank, ref in enumerate(cited, start=1)
        )
    return answer


def _content_hash(article):
    text = "\n".join([article["citation"], article.get("title", ""), article["content"]])
    return hashlib.sha256(text.encode()).hexdigest()


def load_legal_references(articles):
    """Create or update passages, then embed those whose text changed.

    `articles` are dicts with jurisdiction, citation, content and optionally
    title, source_url, effective_date. Returns (created, updated, embedded).
    """
    created = updated = 0
    to_embed = []
    for article in articles:
        content_hash = _content_hash(article)
        reference, was_created = LegalReference.objects.update_or_create(
            jurisdiction=article["jurisdiction"],
            citation=article["citation"],
            defaults={
                "title": article.get("title", ""),
                "content": article["content"],
                "source_url": article.get("source_url", ""),
                "effective_date": article.get("effective_date"),
            },
        )
        created += was_created
        updated += not was_created
        if reference.embedding is None or reference.content_hash != content_hash:
            reference.content_hash = content_hash
            to_embed.append(reference)

    if to_embed:
        vectors = get_provider().embed(
            [f"{ref.citation}\n{ref.title}\n{ref.content}" for ref in to_embed], for_query=False
        )
        for reference, vector in zip(to_embed, vectors, strict=True):
            reference.embedding = vector
        LegalReference.objects.bulk_update(to_embed, ["embedding", "content_hash"])
    return created, updated, len(to_embed)
