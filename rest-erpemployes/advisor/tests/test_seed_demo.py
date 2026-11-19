import pytest
from django.core.management import CommandError, call_command
from django.utils import timezone

from accounts.models import Company
from advisor.facts import company_facts
from billing import selectors
from billing.models import Invoice
from crm.models import FollowUp

pytestmark = pytest.mark.django_db


def test_seed_demo_builds_a_consistent_company(settings):
    settings.DEBUG = True
    call_command("seed_demo")

    company = Company.objects.get(name__endswith="(démo)")
    assert company.memberships.count() == 2
    summary = selectors.financial_summary(company)
    assert summary["overdue_count"] == 1
    assert summary["draft_count"] == 1
    assert Invoice.objects.filter(company=company, kind="credit_note").count() == 1
    assert selectors.cash_position(company)["below_threshold"] is True
    assert FollowUp.objects.filter(company=company, due_date__lte=timezone.localdate()).count() == 2
    topics = {fact.topic for fact in company_facts(company)}
    assert {"finance", "cash", "debtor", "overdue_invoice", "prospect", "dormant_client"} <= topics

    call_command("seed_demo")  # a second run changes nothing
    assert Company.objects.filter(name__endswith="(démo)").count() == 1


def test_seed_demo_refuses_without_debug(settings):
    settings.DEBUG = False
    with pytest.raises(CommandError):
        call_command("seed_demo")
    assert not Company.objects.exists()
