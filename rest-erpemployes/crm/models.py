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
