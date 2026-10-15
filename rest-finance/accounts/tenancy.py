"""Tenant isolation: which company a request acts on, and who may act on it.

The client names the active company in the X-Company-ID header. A user with a
single company may omit it.
"""

import uuid

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from accounts.models import Membership

COMPANY_HEADER = "X-Company-ID"

# Add to @extend_schema(parameters=[...]) on company-scoped views so the header
# shows up in the OpenAPI schema and in Swagger.
COMPANY_HEADER_PARAMETER = OpenApiParameter(
    COMPANY_HEADER,
    OpenApiTypes.UUID,
    OpenApiParameter.HEADER,
    required=False,
    description="Active company. Optional when the user belongs to a single company.",
)


def get_active_membership(request):
    """Return the requesting user's membership for the active company.

    Raises PermissionDenied when the company is unknown, ambiguous, or one the
    user does not belong to. The message never reveals whether it exists.
    """
    memberships = Membership.objects.filter(user=request.user, is_active=True).select_related(
        "company"
    )
    company_id = request.headers.get(COMPANY_HEADER)

    if company_id:
        try:
            company_id = uuid.UUID(company_id)
        except ValueError:
            raise PermissionDenied("Invalid company.") from None
        membership = memberships.filter(company_id=company_id).first()
    else:
        candidates = list(memberships[:2])
        membership = candidates[0] if len(candidates) == 1 else None

    if membership is None:
        raise PermissionDenied("No access to this company.")
    return membership


class IsCompanyMember(BasePermission):
    """Authenticated user with an active membership in the active company.

    Sets request.membership and request.company for the view.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        request.membership = get_active_membership(request)
        request.company = request.membership.company
        return True


class IsCompanyFounder(IsCompanyMember):
    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and request.membership.role == Membership.Role.FOUNDER
        )


class CompanyScopedMixin:
    """For views over CompanyOwnedModel subclasses.

    Reads only return the active company's rows, and created rows are attached
    to it, whatever the request body says.
    """

    permission_classes = [IsCompanyMember]

    def get_queryset(self):
        return super().get_queryset().filter(company=self.request.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.company)
