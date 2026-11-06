from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from core.models import CompanyOwnedModel


class AdvisorExchange(CompanyOwnedModel):
    """One request to the advisor agent and its answer, kept as a log.

    Nothing is edited afterwards. The facts the answer cited are copied as
    they were at that moment, so the founder can later see what the advice
    relied on, even after the invoices change.
    """

    class Kind(models.TextChoices):
        QUESTION = "question", _("Question")
        REMINDER = "reminder", _("Payment reminder draft")

    class Confidence(models.TextChoices):
        HIGH = "high", _("High")
        MEDIUM = "medium", _("Medium")
        LOW = "low", _("Low")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="advisor_exchanges"
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    question = models.TextField(blank=True)
    invoice = models.ForeignKey(
        "billing.Invoice", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    language = models.CharField(max_length=5, choices=settings.LANGUAGES)
    subject = models.CharField(max_length=255, blank=True)
    answer = models.TextField()
    confidence = models.CharField(max_length=10, choices=Confidence.choices)
    # Low confidence: the founder is pointed to a chartered accountant.
    referral = models.BooleanField(default=False)
    # [{"number": 3, "topic": "debtor", "text": "...", "link_type": "client", "link_id": "..."}]
    cited_facts = models.JSONField(default=list)
    fact_count = models.PositiveIntegerField(default=0)
    model_name = models.CharField(max_length=100, blank=True)
    prompt_version = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["company", "user", "-created_at"])]

    def __str__(self):
        return f"{self.get_kind_display()} — {self.created_at:%Y-%m-%d}"
