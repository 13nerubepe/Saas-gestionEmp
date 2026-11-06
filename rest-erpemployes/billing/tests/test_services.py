from datetime import date
from decimal import Decimal

import pytest

from accounts.tests.factories import CompanyFactory
from billing import services
from billing.models import Invoice
from crm.models import Client

pytestmark = pytest.mark.django_db


@pytest.fixture
def company():
    return CompanyFactory(country="CM", tax_id="M012345678901A")


@pytest.fixture
def client(company):
    return Client.objects.create(
        company=company, name="Boulangerie du Littoral", tax_id="P0987", city="Douala"
    )


def line(quantity="1", unit_price="100000", **extra):
    return {
        "description": "Service",
        "quantity": Decimal(quantity),
        "unit_price": Decimal(unit_price),
        **extra,
    }


def test_totals_in_xaf_with_cameroon_vat(company, client):
    invoice = services.create_invoice(
        company=company,
        client=client,
        lines=[line("3", "15000"), line("1", "10001"), line("2", "5000", tax_rate_code="exempt")],
    )

    assert invoice.currency == "XAF"
    standard, odd, exempt = invoice.lines.all()
    assert (standard.subtotal, standard.tax_amount) == (45000, Decimal("8663"))  # 8662.5 rounds up
    assert (odd.subtotal, odd.tax_amount) == (10001, Decimal("1925"))  # 1925.19 → no centimes
    assert (exempt.tax_rate, exempt.tax_amount) == (0, 0)
    assert invoice.subtotal == 65001
    assert invoice.tax_total == 10588
    assert invoice.total == 75589


def test_unknown_tax_rate_is_rejected(company, client):
    with pytest.raises(services.serializers.ValidationError):
        services.create_invoice(company=company, client=client, lines=[line(tax_rate_code="zero")])


def test_country_without_rules_cannot_invoice(client):
    elsewhere = CompanyFactory(country="ZZ")
    with pytest.raises(services.InvoicingNotAvailable):
        services.create_invoice(company=elsewhere, client=client, lines=[line()])


def test_draft_update_replaces_lines_and_totals(company, client):
    invoice = services.create_invoice(company=company, client=client, lines=[line(), line()])
    services.update_invoice(
        invoice, client=client, lines=[line("1", "1000", tax_rate_code="exempt")]
    )

    invoice.refresh_from_db()
    assert invoice.lines.count() == 1
    assert invoice.total == 1000


def test_issue_numbers_continuously_per_company_and_year(company, client):
    other = CompanyFactory(country="CM", tax_id="X")
    other_client = Client.objects.create(company=other, name="Other")

    first = services.issue_invoice(
        services.create_invoice(company=company, client=client, lines=[line()]),
        today=date(2026, 3, 1),
    )
    second = services.issue_invoice(
        services.create_invoice(company=company, client=client, lines=[line()]),
        today=date(2026, 3, 2),
    )
    elsewhere = services.issue_invoice(
        services.create_invoice(company=other, client=other_client, lines=[line()]),
        today=date(2026, 3, 2),
    )
    next_year = services.issue_invoice(
        services.create_invoice(company=company, client=client, lines=[line()]),
        today=date(2027, 1, 2),
    )

    assert [first.number, second.number] == ["FAC-2026-0001", "FAC-2026-0002"]
    assert elsewhere.number == "FAC-2026-0001"
    assert next_year.number == "FAC-2027-0001"


def test_issue_freezes_seller_and_client_details(company, client):
    invoice = services.create_invoice(company=company, client=client, lines=[line()])
    invoice = services.issue_invoice(invoice, today=date(2026, 11, 5))

    client.name = "Renamed"
    client.save()
    invoice.refresh_from_db()

    assert invoice.status == Invoice.Status.ISSUED
    assert invoice.issue_date == date(2026, 11, 5)
    assert invoice.due_date == date(2026, 11, 5)  # no due date given: payable on receipt
    assert (invoice.seller_name, invoice.seller_tax_id) == (company.name, "M012345678901A")
    assert (invoice.client_name, invoice.client_tax_id, invoice.client_address) == (
        "Boulangerie du Littoral",
        "P0987",
        "Douala",
    )


def test_issued_invoice_cannot_change_or_be_deleted(company, client):
    invoice = services.issue_invoice(
        services.create_invoice(company=company, client=client, lines=[line()])
    )

    with pytest.raises(services.InvoiceNotDraft):
        services.update_invoice(invoice, client=client, lines=[line("9")])
    with pytest.raises(services.InvoiceNotDraft):
        services.delete_invoice(invoice)
    with pytest.raises(services.InvoiceNotDraft):
        services.issue_invoice(invoice)


def test_cannot_issue_an_empty_invoice(company, client):
    invoice = services.create_invoice(company=company, client=client, lines=[])
    with pytest.raises(services.InvoiceEmpty):
        services.issue_invoice(invoice)


def test_cannot_issue_without_the_seller_taxpayer_number(client):
    client.company.tax_id = ""
    client.company.save()
    invoice = services.create_invoice(company=client.company, client=client, lines=[line()])

    with pytest.raises(services.SellerDetailsMissing):
        services.issue_invoice(invoice)
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.DRAFT
    assert invoice.number == ""
