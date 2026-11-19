"""US-23: contact import."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.tenancy import COMPANY_HEADER
from accounts.tests.factories import MembershipFactory
from crm.importing import ImportFileError, import_clients
from crm.models import Client

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


def test_unreadable_files_import_nothing(founder):
    for raw in [b"", b"ville,pays\nDouala,CM\n", ("nom\n" + "x\n" * 1001).encode()]:
        with pytest.raises(ImportFileError):
            import_clients(company=founder.company, raw=raw, dry_run=False)
    assert Client.objects.count() == 1


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
    assert (bad.status_code, bad.data["code"]) == (400, "import_file_invalid")


def test_import_goes_to_the_active_company_only(founder):
    other = MembershipFactory(company__country="CM")
    upload(api_for(other), "nom\nClient de l'autre\n", "false")
    assert not Client.objects.filter(company=founder.company, name="Client de l'autre").exists()
    assert APIClient().post(URL, {}, format="multipart").status_code == 401
