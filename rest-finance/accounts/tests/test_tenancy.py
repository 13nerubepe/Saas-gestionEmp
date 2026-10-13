import uuid

import pytest
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
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
