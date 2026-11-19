"""US-23: contact import."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.models import Membership
from accounts.tenancy import COMPANY_HEADER
from accounts.tests.factories import MembershipFactory
from crm.importing import ImportFileError
from crm.models import Client
from crm.services import import_clients

pytestmark = pytest.mark.django_db

URL = "/api/v1/crm/clients/import/"

CSV = (
    "Nom;Téléphone;Ville;Statut;Email\n"
    "Boulangerie Akwa;+237 699 00 00 01;Douala;client;contact@akwa.cm\n"
    "Garage Bonabéri;699000002;Douala;prospect;\n"
    "Doublon téléphone;+237699000002;Yaoundé;;\n"
    ";;;;\n"
    "Sans statut connu;;;partenaire;\n"
    "Mauvais email;;;;pas-un-email\n"
    ";699000009;;;\n"
)


@pytest.fixture
def founder():
    membership = MembershipFactory(company__country="CM")
    Client.objects.create(company=membership.company, name="BOULANGERIE AKWA")
    return membership


def test_dry_run_reports_without_creating(founder):
    result = import_clients(company=founder.company, raw=CSV.encode(), dry_run=True)

    assert result["rows"] == 6  # the blank line is ignored
    assert result["new_count"] == 1
    assert result["preview"] == ["Garage Bonabéri"]
    assert [(s["line"], s["name"]) for s in result["skipped"]] == [
        (2, "Boulangerie Akwa"),  # same name, any case
        (4, "Doublon téléphone"),  # same phone as line 3, +237 or not
    ]
    assert [e["line"] for e in result["errors"]] == [6, 7, 8]
    assert Client.objects.count() == 1


def test_import_creates_the_valid_rows(founder):
    result = import_clients(company=founder.company, raw=CSV.encode("cp1252"), dry_run=False)
    assert result["new_count"] == 1
    garage = Client.objects.get(name="Garage Bonabéri")
    assert (garage.status, garage.kind, garage.country, garage.company) == (
        "prospect",
        "company",
        "CM",
        founder.company,
    )


def test_unreadable_files_import_nothing_and_say_why(founder):
    cases = [
        (b"", "import_file_empty"),
        (b"ville,pays\nDouala,CM\n", "import_name_column_missing"),
        (("nom\n" + "x\n" * 1001).encode(), "import_too_many_rows"),
        (b"nom\n" + b"x" * 1_000_000, "import_file_too_large"),
        (b"PK\x03\x04\x14\x00\x06\x00", "import_file_unreadable"),  # an .xlsx
    ]
    for raw, code in cases:
        with pytest.raises(ImportFileError) as error:
            import_clients(company=founder.company, raw=raw, dry_run=False)
        assert error.value.code == code
    assert Client.objects.count() == 1


def test_excel_unicode_text_is_read(founder):
    raw = "nom\tville\nCafé de la Gare\tDouala\n".encode("utf-16")
    result = import_clients(company=founder.company, raw=raw, dry_run=True)
    assert result["preview"] == ["Café de la Gare"]


def test_apostrophes_never_swallow_lines(founder):
    raw = b"Nom;Notes\nA;'urgent'\nB;'pas fini\nC;ok\nD;ok\n"
    result = import_clients(company=founder.company, raw=raw, dry_run=True)
    assert (result["rows"], result["preview"]) == (4, ["A", "B", "C", "D"])


def test_line_numbers_follow_the_file_with_multiline_fields(founder):
    raw = b'nom,notes,email\nA,"une note\nsur trois\nlignes",\nB,,faux\n'
    result = import_clients(company=founder.company, raw=raw, dry_run=True)
    assert [e["line"] for e in result["errors"]] == [5]


def test_google_contacts_export(founder):
    raw = (
        b"First Name,Last Name,Organization Name,E-mail 1 - Value,Phone 1 - Value\n"
        b"Awa,Mbarga,,awa@example.cm,+237 677 11 22 33\n"
        b"Paul,Etoa,Pharmacie du Centre,,\n"
    )
    import_clients(company=founder.company, raw=raw, dry_run=False)
    awa = Client.objects.get(name="Awa Mbarga")
    assert (awa.kind, awa.email, awa.phone) == ("individual", "awa@example.cm", "+237 677 11 22 33")
    pharmacy = Client.objects.get(name="Pharmacie du Centre")
    assert (pharmacy.kind, pharmacy.contact_name) == ("company", "Paul Etoa")


def api_for(membership):
    api = APIClient()
    api.force_authenticate(membership.user)
    api.credentials(
        **{f"HTTP_{COMPANY_HEADER.upper().replace('-', '_')}": str(membership.company.id)}
    )
    return api


def upload(api, content, dry_run):
    file = SimpleUploadedFile("contacts.csv", content.encode(), content_type="text/csv")
    return api.post(URL, {"file": file, "dry_run": dry_run}, format="multipart")


def test_check_then_import_through_the_api(founder):
    api = api_for(founder)
    check = upload(api, "name,phone\nHôtel du Port,677000000\n", "true")
    assert check.status_code == 200, check.data
    assert (check.data["dry_run"], check.data["new_count"]) == (True, 1)
    assert Client.objects.count() == 1

    done = upload(api, "name,phone\nHôtel du Port,677000000\n", "false")
    assert (done.data["dry_run"], done.data["new_count"]) == (False, 1)
    assert Client.objects.filter(company=founder.company).count() == 2

    bad = upload(api, "ville\nDouala\n", "true")
    assert (bad.status_code, bad.data["code"]) == (400, "import_name_column_missing")


def test_import_goes_to_the_active_company_only(founder):
    # Same user, founder of a second company: the import goes to the company
    # named in the header, never to the other one.
    second = MembershipFactory(user=founder.user, company__country="CM")
    upload(api_for(second), "nom\nClient de la seconde\n", "false")
    assert Client.objects.get(name="Client de la seconde").company == second.company
    assert not Client.objects.filter(company=founder.company, name="Client de la seconde").exists()


def test_who_can_import(founder):
    outsider = MembershipFactory(company__country="CM")
    api = api_for(outsider)
    api.credentials(**{f"HTTP_{COMPANY_HEADER.upper().replace('-', '_')}": str(founder.company.id)})
    assert upload(api, "nom\nIntrus\n", "false").status_code == 403

    employee = MembershipFactory(company=founder.company, role=Membership.Role.EMPLOYEE)
    assert upload(api_for(employee), "nom\nPar un employé\n", "false").status_code == 403

    assert APIClient().post(URL, {}, format="multipart").status_code == 401
    assert not Client.objects.filter(name__in=["Intrus", "Par un employé"]).exists()


def test_large_upload_is_refused_before_reading(founder):
    response = upload(api_for(founder), "nom\n" + "x" * 1_000_001, "true")
    assert (response.status_code, response.data["code"]) == (400, "import_file_too_large")
