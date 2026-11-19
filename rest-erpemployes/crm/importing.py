"""US-23: import contacts from a CSV file (Excel, Google Contacts, phone export).

Two steps for the user: check (dry run), then import. Rows that already exist
(same name, or same phone number) are skipped, invalid rows are reported with
their line number, valid rows are created. Headers may be in French or English.
"""

import csv
import io
import re

from django.db import transaction
from django.utils.translation import gettext as _

from crm.models import Client

MAX_ROWS = 1000
MAX_BYTES = 1_000_000

# Accepted header -> Client field. Lowercase, accents kept as typed by users.
HEADERS = {
    "nom": "name",
    "name": "name",
    "raison sociale": "name",
    "entreprise": "name",
    "statut": "status",
    "status": "status",
    "type": "kind",
    "kind": "kind",
    "contact": "contact_name",
    "personne de contact": "contact_name",
    "contact_name": "contact_name",
    "téléphone": "phone",
    "telephone": "phone",
    "tél": "phone",
    "tel": "phone",
    "phone": "phone",
    "mobile": "phone",
    "email": "email",
    "e-mail": "email",
    "mail": "email",
    "adresse": "address",
    "address": "address",
    "ville": "city",
    "city": "city",
    "pays": "country",
    "country": "country",
    "niu": "tax_id",
    "tax_id": "tax_id",
    "notes": "notes",
    "note": "notes",
}
STATUSES = {
    "prospect": Client.Status.PROSPECT,
    "client": Client.Status.ACTIVE,
    "actif": Client.Status.ACTIVE,
    "active": Client.Status.ACTIVE,
    "client actif": Client.Status.ACTIVE,
    "inactif": Client.Status.INACTIVE,
    "inactive": Client.Status.INACTIVE,
}
KINDS = {
    "entreprise": Client.Kind.COMPANY,
    "société": Client.Kind.COMPANY,
    "company": Client.Kind.COMPANY,
    "particulier": Client.Kind.INDIVIDUAL,
    "individual": Client.Kind.INDIVIDUAL,
}
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ImportFileError(ValueError):
    """The file as a whole cannot be read: nothing is imported."""


def _digits(phone):
    return re.sub(r"\D", "", phone or "")[-9:]  # local part: +237 6xx… and 6xx… match


def _decode(raw):
    for encoding in ("utf-8-sig", "cp1252"):  # Excel on Windows saves CSV in cp1252
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ImportFileError(_("The file is not a readable text (CSV) file."))


def _rows(text):
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    header = next(reader, None)
    if not header:
        raise ImportFileError(_("The file is empty."))
    columns = [HEADERS.get(h.strip().lower()) for h in header]
    if "name" not in columns:
        raise ImportFileError(_('The file needs a "nom" (name) column.'))
    for number, values in enumerate(reader, start=2):  # line 1 is the header
        if not any(v.strip() for v in values):
            continue
        row = {}
        for field, value in zip(columns, values, strict=False):
            if field and value.strip() and field not in row:
                row[field] = value.strip()
        yield number, row


def _clean(row, company):
    """A Client ready to save, or a list of error messages."""
    errors = []
    status = STATUSES.get(row.get("status", "prospect").lower())
    if status is None:
        errors.append(_("Unknown status: %(value)s.") % {"value": row["status"]})
    kind = KINDS.get(row.get("kind", "entreprise").lower())
    if kind is None:
        errors.append(_("Unknown type: %(value)s.") % {"value": row["kind"]})
    email = row.get("email", "")
    if email and not EMAIL.match(email):
        errors.append(_("Invalid email: %(value)s.") % {"value": email})
    country = row.get("country", company.country).upper()
    if len(country) != 2:
        errors.append(_("Country must be a 2-letter code (CM)."))
    if errors:
        return None, errors
    return Client(
        company=company,
        name=row["name"][:255],
        status=status,
        kind=kind,
        contact_name=row.get("contact_name", "")[:255],
        phone=row.get("phone", "")[:50],
        email=email[:254],
        address=row.get("address", "")[:255],
        city=row.get("city", "")[:100],
        country=country,
        tax_id=row.get("tax_id", "")[:100],
        notes=row.get("notes", ""),
    ), []


def import_clients(*, company, raw, dry_run):
    """Check (dry_run) or import a CSV. Returns what was, or would be, done."""
    if len(raw) > MAX_BYTES:
        raise ImportFileError(_("The file is too large (1 MB at most)."))
    rows = list(_rows(_decode(raw)))
    if len(rows) > MAX_ROWS:
        raise ImportFileError(_("Too many rows: 1000 at most per import."))

    existing = Client.objects.filter(company=company)
    names = {name.lower() for name in existing.values_list("name", flat=True)}
    phones = {_digits(p) for p in existing.values_list("phone", flat=True) if _digits(p)}

    to_create, skipped, errors = [], [], []
    for number, row in rows:
        if not row.get("name"):
            errors.append({"line": number, "messages": [_("The name is missing.")]})
            continue
        client, messages = _clean(row, company)
        if messages:
            errors.append({"line": number, "name": row["name"], "messages": messages})
            continue
        phone = _digits(client.phone)
        if client.name.lower() in names or (phone and phone in phones):
            skipped.append({"line": number, "name": client.name})
            continue
        names.add(client.name.lower())
        if phone:
            phones.add(phone)
        to_create.append(client)

    if not dry_run and to_create:
        with transaction.atomic():
            Client.objects.bulk_create(to_create)
    return {
        "dry_run": dry_run,
        "rows": len(rows),
        "new_count": len(to_create),
        "preview": [c.name for c in to_create[:10]],
        "skipped": skipped,
        "errors": errors,
    }
