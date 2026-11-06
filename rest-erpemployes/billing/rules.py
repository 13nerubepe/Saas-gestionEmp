"""Invoicing rules per country: currency, VAT rates, mandatory mentions.

Kept as data, keyed by ISO country code, so business code never hard-codes a
rate or a currency. Add a country by adding an entry; a country without one
cannot issue invoices yet (see `rules_for`).

The Cameroon values follow the Code général des impôts: VAT at 17.5 % plus the
additional council tax (CAC) of 10 % of the VAT, so 19.25 % on the price
before tax. Check them against the texts loaded for the accounting agent
before relying on them for real invoices.
"""

from dataclasses import dataclass
from decimal import Decimal

from django.utils.translation import gettext_lazy as _


@dataclass(frozen=True)
class TaxRate:
    code: str
    rate: Decimal  # percent of the price before tax
    label: str


@dataclass(frozen=True)
class PaymentMethod:
    code: str
    label: str


@dataclass(frozen=True)
class CountryRules:
    currency: str
    # Decimal places of the currency: amounts are rounded to this when computed.
    currency_decimals: int
    tax_rates: tuple[TaxRate, ...]
    default_tax_rate: str
    # Company fields that must be filled before an invoice is issued.
    required_seller_fields: tuple[str, ...]
    invoice_prefix: str
    credit_note_prefix: str
    # How clients pay in this country: mobile money operators differ by country.
    payment_methods: tuple[PaymentMethod, ...]


COUNTRY_RULES = {
    "CM": CountryRules(
        currency="XAF",
        currency_decimals=0,
        tax_rates=(
            TaxRate("standard", Decimal("19.25"), _("VAT 17.5% + council tax (19.25%)")),
            TaxRate("exempt", Decimal("0"), _("Exempt from VAT")),
        ),
        default_tax_rate="standard",
        # NIU (taxpayer number) on every invoice.
        required_seller_fields=("tax_id",),
        invoice_prefix="FAC",
        credit_note_prefix="AV",
        payment_methods=(
            PaymentMethod("cash", _("Cash")),
            PaymentMethod("mtn_momo", _("MTN Mobile Money")),
            PaymentMethod("orange_money", _("Orange Money")),
            PaymentMethod("bank_transfer", _("Bank transfer")),
            PaymentMethod("cheque", _("Cheque")),
            PaymentMethod("other", _("Other")),
        ),
    ),
}


def rules_for(country):
    """The rules of `country`, or None when invoicing is not set up for it."""
    return COUNTRY_RULES.get(country)
