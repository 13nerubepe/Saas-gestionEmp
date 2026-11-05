import uuid

import pytest
from rest_framework.response import Response
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from accounts.models import Membership
from accounts.tenancy import COMPANY_HEADER, IsCompanyFounder, IsCompanyMember
from accounts.tests.factories import CompanyFactory, MembershipFactory, UserFactory

pytestmark = pytest.mark.django_db


class MemberView(APIView):
    permission_classes = [IsCompanyMember]

    def get(self, request):
        return Response({"company": str(request.company.id)})


class FounderView(MemberView):
    permission_classes = [IsCompanyFounder]


def call(view, user=None, company_id=None):
    headers = {COMPANY_HEADER: str(company_id)} if company_id else {}
    request = APIRequestFactory().get("/", headers=headers)
    if user:
        force_authenticate(request, user=user)
    return view.as_view()(request)


def test_anonymous_is_rejected():
    assert call(MemberView).status_code == 401


def test_single_company_is_used_without_header():
    membership = MembershipFactory()

    response = call(MemberView, user=membership.user)

    assert response.status_code == 200
    assert response.data["company"] == str(membership.company.id)


def test_header_selects_among_several_companies():
    user = UserFactory()
    MembershipFactory(user=user)
    second = MembershipFactory(user=user)

    response = call(MemberView, user=user, company_id=second.company.id)

    assert response.data["company"] == str(second.company.id)


def test_several_companies_without_header_is_rejected():
    user = UserFactory()
    MembershipFactory(user=user)
    MembershipFactory(user=user)

    assert call(MemberView, user=user).status_code == 403


def test_other_company_is_rejected():
    membership = MembershipFactory()
    other_company = CompanyFactory()

    assert call(MemberView, user=membership.user, company_id=other_company.id).status_code == 403


@pytest.mark.parametrize("company_id", ["not-a-uuid", uuid.uuid4()])
def test_unknown_company_is_rejected(company_id):
    membership = MembershipFactory()

    assert call(MemberView, user=membership.user, company_id=company_id).status_code == 403


def test_inactive_membership_is_rejected():
    membership = MembershipFactory(is_active=False)

    response = call(MemberView, user=membership.user, company_id=membership.company.id)

    assert response.status_code == 403


def test_founder_only_view_rejects_employees():
    employee = MembershipFactory(role=Membership.Role.EMPLOYEE)
    founder = MembershipFactory()

    assert call(FounderView, user=employee.user).status_code == 403
    assert call(FounderView, user=founder.user).status_code == 200


# Active company details (needed on invoices)

COMPANY_URL = "/api/v1/auth/company/"


def _api(membership):
    api = APIClient()
    api.force_authenticate(membership.user)
    api.credentials(HTTP_X_COMPANY_ID=str(membership.company.id))
    return api


def test_founder_edits_company_details_but_not_country_or_currency():
    founder = MembershipFactory()
    response = _api(founder).patch(
        COMPANY_URL, {"tax_id": "M0123", "legal_form": "SARL", "country": "FR", "currency": "EUR"}
    )
    assert response.status_code == 200
    founder.company.refresh_from_db()
    assert (founder.company.tax_id, founder.company.legal_form) == ("M0123", "SARL")
    assert (founder.company.country, founder.company.currency) == ("CM", "XAF")


def test_employee_reads_company_but_cannot_edit():
    founder = MembershipFactory()
    employee = MembershipFactory(company=founder.company, role=Membership.Role.EMPLOYEE)
    api = _api(employee)
    assert api.get(COMPANY_URL).data["name"] == founder.company.name
    assert api.patch(COMPANY_URL, {"tax_id": "X"}).status_code == 403


def test_company_endpoint_uses_the_active_company_only():
    founder = MembershipFactory()
    other = MembershipFactory()
    api = APIClient()
    api.force_authenticate(founder.user)
    api.credentials(HTTP_X_COMPANY_ID=str(other.company.id))
    assert api.patch(COMPANY_URL, {"tax_id": "HACK"}).status_code == 403
    other.company.refresh_from_db()
    assert other.company.tax_id == ""
