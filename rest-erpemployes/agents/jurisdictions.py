"""Which bodies of law apply to a company, from its country.

`LegalReference.jurisdiction` holds either an ISO country code ("CM") or the
code of a regional organisation below.
"""

# Member states, as ISO 3166-1 alpha-2 codes.
REGIONAL_ORGANISATIONS = {
    # Business law harmonisation in Africa (uniform acts).
    "OHADA": set("BJ BF CM CF TD KM CG CD CI GQ GA GN GW ML NE SN TG".split()),
    # Central African economic and monetary community.
    "CEMAC": {"CM", "CF", "TD", "CG", "GQ", "GA"},
}


def applicable_jurisdictions(country):
    """The country itself first, then the regional organisations it belongs to."""
    regional = sorted(
        code for code, members in REGIONAL_ORGANISATIONS.items() if country in members
    )
    return [country, *regional]
