from django.db import transaction

from accounts.models import Company, Membership, User


@transaction.atomic
def create_company(*, founder, name, country="CM", currency="XAF", **extra_fields):
    """Create a company and make `founder` its first member.

    Both rows are written in one transaction: a company without a founder
    would be unreachable by anyone.
    """
    company = Company.objects.create(name=name, country=country, currency=currency, **extra_fields)
    Membership.objects.create(user=founder, company=company, role=Membership.Role.FOUNDER)
    return company


@transaction.atomic
def register_founder(
    *,
    email,
    password,
    company_name,
    country="CM",
    first_name="",
    last_name="",
    language="fr",
):
    """Create a user account together with the company they found."""
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        language=language,
    )
    create_company(founder=user, name=company_name, country=country)
    return user
