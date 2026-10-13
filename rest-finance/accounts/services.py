from django.db import transaction

from accounts.models import Company, Membership


@transaction.atomic
def create_company(*, founder, name, country="CM", currency="XAF", **extra_fields):
    """Create a company and make `founder` its first member.

    Both rows are written in one transaction: a company without a founder
    would be unreachable by anyone.
    """
    company = Company.objects.create(name=name, country=country, currency=currency, **extra_fields)
    Membership.objects.create(user=founder, company=company, role=Membership.Role.FOUNDER)
    return company
