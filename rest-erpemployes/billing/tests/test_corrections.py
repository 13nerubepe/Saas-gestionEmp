"""Credit notes, payment reversals, cash movements: money history is never rewritten."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Membership
from accounts.tenancy import COMPANY_HEADER
from accounts.tests.factories import MembershipFactory
from billing import selectors, services
from billing.models import CashMovement, Invoice, Payment
from crm.models import Client

pytestmark = pytest.mark.django_db

TODAY = timezone.localdate()


@pytest.fixture
def founder():
    return MembershipFactory(
        company__country="CM",
        company__tax_id="M0123",
        company__trade_register="RC/DLA/2024/B/1234",
        company__address="Rue Joss, Bonanjo, Douala",
    )


@pytest.fixture
def client(founder):
    return Client.objects.create(company=founder.company, name="Acme SARL")


def issued(company, client, amount=100000, **extra):
    line = {"description": "Service", "quantity": Decimal(1), "unit_price": Decimal(amount)}
    draft = services.create_invoice(company=company, client=client, lines=[line], **extra)
    return services.issue_invoice(draft)


def pay(invoice, amount, method="cash"):
    return services.record_payment(
        invoice, amount=Decimal(amount), paid_on=TODAY, method=method, user=None
    )


# Invoice mentions


def test_issue_freezes_trade_register_and_address(founder, client):
    invoice = issued(founder.company, client)
    assert invoice.seller_trade_register == "RC/DLA/2024/B/1234"
    assert invoice.seller_address == "Rue Joss, Bonanjo, Douala"


# Credit notes


def test_credit_note_cancels_the_invoice_with_its_own_numbering(founder, client):
    invoice = issued(founder.company, client)
    note = services.create_credit_note(invoice, reason="Commande annulée par le client")

    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.CANCELLED
    assert note.kind == Invoice.Kind.CREDIT_NOTE
    assert note.number == f"AV-{TODAY.year}-0001"
    assert note.credited_invoice == invoice
    assert (note.total, note.lines.count()) == (invoice.total, 1)
    assert note.notes == "Commande annulée par le client"
    # The invoice sequence is untouched: the next invoice follows the last one.
    assert issued(founder.company, client).number == f"FAC-{TODAY.year}-0002"


def test_cancelled_invoices_and_credit_notes_never_count(founder, client):
    services.create_credit_note(issued(founder.company, client), reason="Erreur de client")
    summary = selectors.financial_summary(founder.company)
    assert (summary["outstanding"], summary["invoiced_this_year"], summary["open_count"]) == (
        0,
        0,
        0,
    )
    assert selectors.receivables_by_client(founder.company) == []


def test_credit_note_rules(founder, client):
    paid = issued(founder.company, client)
    pay(paid, 1000)
    with pytest.raises(services.InvoiceHasPayments):
        services.create_credit_note(paid, reason="Erreur")

    draft = services.create_invoice(company=founder.company, client=client, lines=[])
    with pytest.raises(services.NotCancellable):
        services.create_credit_note(draft, reason="Erreur")

    invoice = issued(founder.company, client)
    note = services.create_credit_note(invoice, reason="Erreur")
    with pytest.raises(services.NotCancellable):
        services.create_credit_note(invoice, reason="Encore")
    with pytest.raises(services.NotCancellable):
        services.create_credit_note(note, reason="Avoir d'un avoir")
    with pytest.raises(services.InvoiceNotPayable):
        pay(note, 1)


# Payment reversals


def test_reversal_reopens_a_paid_invoice(founder, client):
    invoice = issued(founder.company, client)
    payment = pay(invoice, invoice.total, method="mtn_momo")
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.PAID

    reversal = services.reverse_payment(payment, reason="Transfert MoMo échoué", user=None)

    invoice.refresh_from_db()
    assert (invoice.status, invoice.amount_paid) == (Invoice.Status.ISSUED, 0)
    assert reversal.amount == -payment.amount
    assert (reversal.reversal_of, reversal.reason) == (payment, "Transfert MoMo échoué")
    assert Payment.objects.count() == 2  # nothing deleted
    assert selectors.financial_summary(founder.company)["collected_this_year"] == 0


def test_a_payment_is_reversed_once(founder, client):
    payment = pay(issued(founder.company, client), 5000)
    reversal = services.reverse_payment(payment, reason="Doublon", user=None)
    with pytest.raises(services.AlreadyReversed):
        services.reverse_payment(payment, reason="Encore", user=None)
    with pytest.raises(services.AlreadyReversed):
        services.reverse_payment(reversal, reason="Annuler l'annulation", user=None)


def test_reverse_then_cancel_an_invoice(founder, client):
    invoice = issued(founder.company, client)
    services.reverse_payment(pay(invoice, 5000), reason="Erreur de saisie", user=None)
    note = services.create_credit_note(invoice, reason="Facture faite au mauvais client")
    assert note.number.startswith("AV-")


# Cash movements


def move(company, direction, category, amount, **extra):
    return services.record_cash_movement(
        company=company,
        direction=direction,
        category=category,
        amount=Decimal(amount),
        occurred_on=extra.pop("occurred_on", TODAY),
        method=extra.pop("method", "cash"),
        label=extra.pop("label", "Mouvement"),
        user=None,
    )


def test_cash_position_adds_payments_and_movements(founder, client):
    company = founder.company
    company.cash_alert_threshold = Decimal(500000)
    company.save()
    move(company, "in", "opening_balance", 400000, occurred_on=TODAY - timedelta(days=60))
    pay(issued(company, client), 50000)
    move(company, "out", "rent", 75000)
    move(company, "out", "transport", 10000, method="orange_money")
    wrong = move(company, "out", "supplies", 99999)
    services.reverse_cash_movement(wrong, reason="Saisi deux fois", user=None)

    cash = selectors.cash_position(company)
    assert cash["balance"] == 400000 + 50000 - 75000 - 10000
    assert cash["payments_this_month"] == 50000
    assert cash["out_this_month"] == 85000
    assert [row["category"] for row in cash["expenses_this_month"]] == ["rent", "transport"]
    assert (cash["alert_threshold"], cash["below_threshold"]) == (500000, True)


def test_cash_movement_rules(founder):
    company = founder.company
    with pytest.raises(services.serializers.ValidationError):
        move(company, "in", "rent", 1000)  # rent is money out
    with pytest.raises(services.serializers.ValidationError):
        move(company, "out", "loan", 1000)  # a loan received is money in
    with pytest.raises(services.serializers.ValidationError):
        move(company, "out", "rent", 0)
    with pytest.raises(services.serializers.ValidationError):
        move(company, "out", "rent", 1000, method="paypal")
    with pytest.raises(services.serializers.ValidationError):
        move(company, "out", "rent", 1000, occurred_on=TODAY + timedelta(days=1))
    assert move(company, "out", "other", 1).direction == "out"
    assert move(company, "in", "other", 1).direction == "in"
    assert not selectors.cash_position(company)["below_threshold"]  # no threshold set


# API


def api_for(membership):
    api = APIClient()
    api.force_authenticate(membership.user)
    api.credentials(
        **{f"HTTP_{COMPANY_HEADER.upper().replace('-', '_')}": str(membership.company.id)}
    )
    return api


def test_corrections_through_the_api(founder, client):
    api = api_for(founder)
    invoice = issued(founder.company, client)
    payment = pay(invoice, 2000)

    reversal = api.post(
        f"/api/v1/billing/payments/{payment.id}/reverse/", {"reason": "Erreur"}, format="json"
    )
    assert reversal.status_code == 201
    assert reversal.data["amount"] == "-2000.00"
    detail = api.get(f"/api/v1/billing/invoices/{invoice.id}/").data
    assert [p["is_reversed"] for p in detail["payments"] if p["reversal_of"] is None] == [True]

    note = api.post(
        f"/api/v1/billing/invoices/{invoice.id}/credit-note/", {"reason": "Annulée"}, format="json"
    )
    assert note.status_code == 201
    assert (note.data["kind"], note.data["credited_invoice_number"]) == (
        "credit_note",
        invoice.number,
    )
    detail = api.get(f"/api/v1/billing/invoices/{invoice.id}/").data
    assert (detail["status"], detail["credit_note_number"]) == ("cancelled", note.data["number"])

    again = api.post(
        f"/api/v1/billing/invoices/{invoice.id}/credit-note/", {"reason": "x" * 5}, format="json"
    )
    assert (again.status_code, again.data["code"]) == (409, "invoice_not_cancellable")


def test_cash_api_and_summary(founder):
    api = api_for(founder)
    body = {
        "direction": "out",
        "category": "rent",
        "amount": "75000",
        "occurred_on": str(TODAY),
        "method": "cash",
        "label": "Loyer novembre",
    }
    created = api.post("/api/v1/billing/cash-movements/", body, format="json")
    assert created.status_code == 201, created.data
    assert api.get("/api/v1/billing/cash-movements/", {"direction": "in"}).data["count"] == 0
    assert api.get("/api/v1/billing/summary/").data["cash"]["balance"] == "-75000.00"

    reverse_url = f"/api/v1/billing/cash-movements/{created.data['id']}/reverse/"
    assert api.post(reverse_url, {"reason": "Erreur"}, format="json").status_code == 201
    assert api.post(reverse_url, {"reason": "Erreur"}, format="json").status_code == 409


def test_corrections_are_scoped_and_founder_only(founder, client):
    payment = pay(issued(founder.company, client), 1000)
    movement = move(founder.company, "out", "rent", 1000)
    intruder = api_for(MembershipFactory(company__country="CM"))
    employee = api_for(MembershipFactory(company=founder.company, role=Membership.Role.EMPLOYEE))
    urls = [
        f"/api/v1/billing/payments/{payment.id}/reverse/",
        f"/api/v1/billing/cash-movements/{movement.id}/reverse/",
        f"/api/v1/billing/invoices/{payment.invoice_id}/credit-note/",
    ]
    for url in urls:
        assert intruder.post(url, {"reason": "Pirate"}, format="json").status_code == 404
        assert employee.post(url, {"reason": "Pirate"}, format="json").status_code == 403
    assert intruder.get("/api/v1/billing/cash-movements/").data["count"] == 0
    assert employee.get("/api/v1/billing/cash-movements/").status_code == 403
    assert CashMovement.objects.count() == 1


def test_company_settings_through_the_api(founder):
    response = api_for(founder).patch(
        "/api/v1/auth/company/",
        {"trade_register": "RC/YAO/2025/A/9", "cash_alert_threshold": "250000"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["cash_alert_threshold"] == "250000.00"


def test_time_zone_is_cameroon(settings):
    assert settings.TIME_ZONE == "Africa/Douala"
    assert isinstance(TODAY, date)
