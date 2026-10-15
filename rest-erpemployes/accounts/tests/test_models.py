import pytest
from django.db import IntegrityError

from accounts.models import Membership, User
from accounts.services import create_company
from accounts.tests.factories import MembershipFactory, UserFactory

pytestmark = pytest.mark.django_db


def test_create_user_logs_in_by_email():
    user = User.objects.create_user(email="Founder@Example.COM", password="pass-word-123")

    assert user.email == "Founder@example.com"
    assert user.check_password("pass-word-123")
    assert not user.is_staff


def test_create_user_requires_email():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password="pass-word-123")


def test_create_superuser():
    user = User.objects.create_superuser(email="admin@example.com", password="pass-word-123")

    assert user.is_staff and user.is_superuser


def test_create_company_makes_the_founder_a_member():
    founder = UserFactory()

    company = create_company(founder=founder, name="Acme")

    membership = Membership.objects.get(company=company)
    assert membership.user == founder
    assert membership.role == Membership.Role.FOUNDER
    assert (company.country, company.currency) == ("CM", "XAF")


def test_a_user_can_found_several_companies():
    founder = UserFactory()

    create_company(founder=founder, name="Acme")
    create_company(founder=founder, name="Globex")

    assert founder.companies.count() == 2


def test_a_user_joins_a_company_only_once():
    membership = MembershipFactory()

    with pytest.raises(IntegrityError):
        MembershipFactory(user=membership.user, company=membership.company)
