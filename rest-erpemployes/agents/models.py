from django.conf import settings
from django.db import models
from pgvector.django import HnswIndex, VectorField

from core.models import BaseModel, CompanyOwnedModel


class LegalReference(BaseModel):
    """One citable passage of law, usually an article.

    Shared knowledge, not company data: it is not a CompanyOwnedModel. Loaded
    with `manage.py load_legal_texts`.
    """

    jurisdiction = models.CharField(max_length=10, help_text="ISO country code or OHADA, CEMAC…")
    citation = models.CharField(max_length=255, help_text="e.g. « Code du travail, art. 28 »")
    title = models.CharField(max_length=255, blank=True)
    content = models.TextField()
    source_url = models.URLField(blank=True)
    effective_date = models.DateField(null=True, blank=True)
    # Lets the loader skip re-embedding passages whose text did not change.
    content_hash = models.CharField(max_length=64, blank=True)
    embedding = VectorField(dimensions=settings.EMBEDDING_DIMENSIONS, null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["jurisdiction", "citation"], name="unique_legal_reference"
            ),
        ]
        indexes = [
            HnswIndex(
                name="legal_reference_embedding",
                fields=["embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
        ]

    def __str__(self):
        return f"[{self.jurisdiction}] {self.citation}"


class Conversation(CompanyOwnedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations"
    )
    title = models.CharField(max_length=255)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Query(BaseModel):
    """A question asked by the user."""

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="queries")
    text = models.TextField()
    language = models.CharField(max_length=5, choices=settings.LANGUAGES)

    class Meta:
        ordering = ["created_at"]
        verbose_name_plural = "queries"

    def __str__(self):
        return self.text[:80]


class Answer(BaseModel):
    query = models.OneToOneField(Query, on_delete=models.CASCADE, related_name="answer")
    text = models.TextField()
    # True only when the answer cites at least one passage. False when nothing was
    # retrieved (the model was not called) or when the model cited nothing.
    found_sources = models.BooleanField()
    model_name = models.CharField(max_length=100, blank=True)
    prompt_version = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return self.text[:80]


class Source(BaseModel):
    """A legal passage cited by an answer."""

    answer = models.ForeignKey(Answer, on_delete=models.CASCADE, related_name="sources")
    legal_reference = models.ForeignKey(
        LegalReference, on_delete=models.PROTECT, related_name="citations"
    )
    rank = models.PositiveSmallIntegerField()
    distance = models.FloatField(help_text="Cosine distance to the question; lower is closer.")

    class Meta:
        ordering = ["rank"]
