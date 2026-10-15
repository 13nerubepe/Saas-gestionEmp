import uuid

from django.db import models


class BaseModel(models.Model):
    """UUID primary key and timestamps, shared by every model of the project."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class CompanyOwnedModel(BaseModel):
    """Base for business data: every row belongs to exactly one company.

    Views over these models use accounts.tenancy.CompanyScopedMixin, which
    filters on the active company so no view has to remember to do it.
    """

    company = models.ForeignKey(
        "accounts.Company",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_set",
    )

    class Meta:
        abstract = True
