"""US-23: read a contacts CSV (Excel, Google Contacts, phone export).

Parsing and validation only: nothing here writes to the database. The import
itself (duplicates against the client list, creation) is
`crm.services.import_clients`. Headers may be in French or English.
"""

import codecs
import csv
import io
import re

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
    # Google Contacts export
    "phone 1 - value": "phone",
    "e-mail 1 - value": "email",
    "address 1 - formatted": "address",
    "address 1 - city": "city",
    "organization name": "organization",
    "organization 1 - name": "organization",
    # Person names, joined into the client name when there is no "nom" column
    "prénom": "first_name",
    "prenom": "first_name",
    "first name": "first_name",
    "given name": "first_name",
    "nom de famille": "last_name",
    "last name": "last_name",
    "family name": "last_name",
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
    """The file as a whole cannot be read: nothing is imported.

    `code` is the stable API error code the client translates.
    """

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def phone_key(phone):
    """The local part of a phone number: +237 6xx… and 6xx… match."""
    return re.sub(r"\D", "", phone or "")[-9:]


def _decode(raw):
    if raw.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):  # Excel "Unicode text"
        return raw.decode("utf-16")
    if b"\x00" in raw:  # a binary file: an .xlsx workbook, a picture...
        raise ImportFileError(
            "import_file_unreadable", _("The file is not a readable text (CSV) file.")
        )
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")  # Excel on Windows saves CSV in cp1252


def _delimiter(header_line):
    """The separator the header uses: Excel in French writes ";", others ",".

    Only the header is looked at, and quotes are always '"': guessing the
    quote character from the data can swallow lines into a field.
    """
    return max(";,\t", key=header_line.count)


def _rows(text):
    """(line number, {field: value}) for each non-blank record."""
    header_line = text.split("\n", 1)[0]
    reader = csv.reader(io.StringIO(text), delimiter=_delimiter(header_line), quotechar='"')
    header = next(reader, None)
    if not header or not any(h.strip() for h in header):
        raise ImportFileError("import_file_empty", _("The file is empty."))
    columns = [HEADERS.get(h.strip().lower()) for h in header]
    person_name = "name" not in columns and ("first_name" in columns or "last_name" in columns)
    if "name" not in columns and not person_name and "organization" not in columns:
        raise ImportFileError(
            "import_name_column_missing", _('The file needs a "nom" (name) column.')
        )
    line = reader.line_num
    for values in reader:
        number, line = line + 1, reader.line_num  # first line of this record
        if not any(v.strip() for v in values):
            continue
        row = {}
        for field, value in zip(columns, values, strict=False):
            if field and value.strip() and field not in row:
                row[field] = value.strip()
        if "name" not in row:
            person = " ".join(filter(None, [row.get("first_name"), row.get("last_name")]))
            if row.get("organization"):
                row["name"] = row["organization"]
                row.setdefault("contact_name", person)
            elif person:
                row["name"] = person
                row.setdefault("kind", "particulier")
        yield number, row


def build_client(row, company):
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


def parse(raw):
    """Decode and read a whole file: [(line number, row)], or ImportFileError."""
    rows = list(_rows(_decode(raw)))
    if len(rows) > MAX_ROWS:
        raise ImportFileError("import_too_many_rows", _("Too many rows: 1000 at most per import."))
    return rows
