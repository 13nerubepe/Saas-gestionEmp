from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from core.models import BaseModel, CompanyOwnedModel


class Client(CompanyOwnedModel):
    """US-03: everything about a client in one place."""

    class Kind(models.TextChoices):
        COMPANY = "company", _("Company")
        INDIVIDUAL = "individual", _("Individual")

    class Status(models.TextChoices):
        PROSPECT = "prospect", _("Prospect")
        ACTIVE = "active", _("Active")
        INACTIVE = "inactive", _("Inactive")

    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.COMPANY)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROSPECT)
    contact_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=2, blank=True, help_text="ISO 3166-1 alpha-2")
    tax_id = models.CharField(max_length=100, blank=True, help_text="e.g. NIU in Cameroon")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["company", "name"])]

    def __str__(self):
        return self.name


class Interaction(BaseModel):
    """US-04: one exchange with a client. Never edited or deleted: the history stays whole."""

    class Kind(models.TextChoices):
        CALL = "call", _("Call")
        EMAIL = "email", _("Email")
        MEETING = "meeting", _("Meeting")
        MESSAGE = "message", _("Message")
        NOTE = "note", _("Note")

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="interactions")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    occurred_at = models.DateTimeField()
    summary = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )

    class Meta:
        ordering = ["-occurred_at", "-created_at"]

    def __str__(self):
        return f"{self.get_kind_display()} — {self.client}"


class FollowUp(CompanyOwnedModel):
    """US-05: a dated reminder to get back to a client or prospect.

    Done once: completing it records what happened as an Interaction, so the
    client's history (US-04) stays the single place where exchanges live.
    Postponing keeps the earlier dates in `postponements`.
    """

    class Channel(models.TextChoices):
        CALL = "call", _("Call")
        WHATSAPP = "whatsapp", _("WhatsApp")
        EMAIL = "email", _("Email")
        MEETING = "meeting", _("Meeting")
        OTHER = "other", _("Other")

    class Status(models.TextChoices):
        OPEN = "open", _("To do")
        DONE = "done", _("Done")

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="follow_ups")
    due_date = models.DateField()
    reason = models.CharField(max_length=255)
    channel = models.CharField(max_length=20, choices=Channel.choices, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    # [{"from": "2026-11-20", "to": "2026-11-25", "at": "<iso datetime>"}]
    postponements = models.JSONField(default=list, blank=True)
    done_at = models.DateTimeField(null=True, blank=True)
    # The exchange recorded when the follow-up was done.
    outcome = models.OneToOneField(
        Interaction, on_delete=models.SET_NULL, null=True, blank=True, related_name="follow_up"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )

    class Meta:
        ordering = ["due_date", "created_at"]
        indexes = [models.Index(fields=["company", "status", "due_date"])]

    def __str__(self):
        return f"{self.reason} — {self.client} ({self.due_date})"
