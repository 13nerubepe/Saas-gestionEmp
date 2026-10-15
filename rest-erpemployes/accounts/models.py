import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _

from accounts.managers import UserManager
from core.models import BaseModel


class User(AbstractUser):
    """Project user, identified by email instead of a username."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(_("email address"), unique=True)
    language = models.CharField(max_length=5, choices=settings.LANGUAGES, default="fr")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


class Company(BaseModel):
    """The tenant. Country and currency drive legal sources, taxes and invoices."""

    name = models.CharField(max_length=255)
    country = models.CharField(max_length=2, default="CM", help_text="ISO 3166-1 alpha-2")
    currency = models.CharField(max_length=3, default="XAF", help_text="ISO 4217")
    legal_form = models.CharField(max_length=100, blank=True)
    tax_id = models.CharField(max_length=100, blank=True)
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL, through="Membership", related_name="companies"
    )

    class Meta:
        verbose_name_plural = "companies"

    def __str__(self):
        return self.name


class Membership(BaseModel):
    """Links a user to a company and carries their role in that company."""

    class Role(models.TextChoices):
        FOUNDER = "founder", _("Founder")
        EMPLOYEE = "employee", _("Employee")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=20, choices=Role.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "company"], name="unique_user_company"),
        ]

    def __str__(self):
        return f"{self.user} @ {self.company} ({self.role})"
