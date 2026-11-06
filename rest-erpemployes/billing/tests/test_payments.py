from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Membership
from accounts.tenancy import COMPANY_HEADER
from accounts.tests.factories import MembershipFactory
from billing import services
from billing.models import Invoice, Payment
from crm.models import Client

pytestmark = pytest.mark.django_db

TODAY = timezone.localdate()


@pytest.fixture
def founder():
    return MembershipFactory(company__country="CM", company__tax_id="M0123")


@pytest.fixture
def invoice(founder):
    client = Client.objects.create(company=founder.company, name="Acme SARL")
    draft = services.create_invoice(
        company=founder.company,
        client=client,
        lines=[{"description": "Conseil", "quantity": Decimal(1), "unit_price": Decimal(100000)}],
    )
    return services.issue_invoice(draft)  # total 119 250 XAF


def pay(invoice, amount, **extra):
    return services.record_payment(
        invoice,
        amount=Decimal(amount),
        paid_on=extra.pop("paid_on", TODAY),
        method=extra.pop("method", "mtn_momo"),
        user=None,
        **extra,
    )


def test_partial_then_full_payment_marks_the_invoice_paid(invoice):
    pay(invoice, "50000")
    invoice.refresh_from_db()
    assert (invoice.status, invoice.amount_paid, invoice.balance_due) == ("issued", 50000, 69250)

    pay(invoice, "69250", method="cash", reference="REC-12")
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.PAID
    assert invoice.balance_due == 0
    assert Payment.objects.filter(invoice=invoice).count() == 2


def test_payment_guards(invoice, founder):
    with pytest.raises(services.PaymentExceedsBalance):
        pay(invoice, "119251")
    with pytest.raises(services.serializers.ValidationError):
        pay(invoice, "0")
    with pytest.raises(services.serializers.ValidationError):
        pay(invoice, "1000", method="paypal")
    with pytest.raises(services.serializers.ValidationError):
        pay(invoice, "1000", paid_on=TODAY + timedelta(days=1))

    draft = services.create_invoice(company=founder.company, client=invoice.client, lines=[])
    with pytest.raises(services.InvoiceNotPayable):
        pay(draft, "1000")

    pay(invoice, "119250")
    with pytest.raises(services.InvoiceNotPayable):
        pay(invoice, "1")


def test_amount_is_rounded_to_the_currency(invoice):
    payment = pay(invoice, "1000.40")
    assert payment.amount == 1000


def test_paid_invoice_is_never_overdue(invoice):
    invoice.due_date = TODAY - timedelta(days=10)
    invoice.save()
    pay(invoice, "119250")
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.PAID


# API


def api_for(membership):
    api = APIClient()
    api.force_authenticate(membership.user)
    api.credentials(
        **{f"HTTP_{COMPANY_HEADER.upper().replace('-', '_')}": str(membership.company.id)}
    )
    return api


def test_record_payment_through_the_api(founder, invoice):
    url = f"/api/v1/billing/invoices/{invoice.id}/payments/"
    response = api_for(founder).post(
        url, {"amount": "19250", "paid_on": str(TODAY), "method": "orange_money"}, format="json"
    )
    assert response.status_code == 201, response.data
    assert response.data["amount_paid"] == "19250.00"
    assert response.data["balance_due"] == "100000.00"
    assert response.data["payments"][0]["method"] == "orange_money"

    too_much = api_for(founder).post(
        url, {"amount": "100001", "paid_on": str(TODAY), "method": "cash"}, format="json"
    )
    assert too_much.status_code == 400
    assert too_much.data["code"] == "payment_exceeds_balance"


def test_payments_are_scoped_and_founder_only(founder, invoice):
    url = f"/api/v1/billing/invoices/{invoice.id}/payments/"
    body = {"amount": "1000", "paid_on": str(TODAY), "method": "cash"}
    intruder = api_for(MembershipFactory(company__country="CM"))
    employee = api_for(MembershipFactory(company=founder.company, role=Membership.Role.EMPLOYEE))

    assert intruder.post(url, body, format="json").status_code == 404
    assert employee.post(url, body, format="json").status_code == 403
    assert not Payment.objects.exists()


def test_rules_list_payment_methods(founder):
    response = api_for(founder).get("/api/v1/billing/rules/")
    codes = [m["code"] for m in response.data["payment_methods"]]
    assert "mtn_momo" in codes and "orange_money" in codes
