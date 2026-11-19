"""Fill a local database with a fictitious company to try every screen.

Lives in `advisor` because it is the app at the top of the dependency graph:
it may import accounts, crm and billing, none of which may import it.
All data is fictitious. It goes through the services, like the application
does, so numbers, balances and statuses are consistent.
"""

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Company, Membership, User
from accounts.services import register_founder
from billing import services as billing
from crm import services as crm_services
from crm.models import Client, FollowUp, Interaction

COMPANY_NAME = "Awa Services SARL (démo)"
FOUNDER_EMAIL = "demo@gestionemp.cm"
EMPLOYEE_EMAIL = "employe@gestionemp.cm"
PASSWORD = "Demo-Douala-2026"


class Command(BaseCommand):
    help = (
        "Creates a fictitious company (Cameroon) with clients, invoices, payments and "
        "cash movements, plus a founder and an employee account. Local development only."
    )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo only runs with DEBUG=True: it is for a local database.")
        if Company.objects.filter(name=COMPANY_NAME).exists():
            self.stdout.write(self.style.WARNING("The demo company already exists: nothing to do."))
            self._print_logins()
            return
        if User.objects.filter(email__in=[FOUNDER_EMAIL, EMPLOYEE_EMAIL]).exists():
            raise CommandError(
                f"{FOUNDER_EMAIL} or {EMPLOYEE_EMAIL} already exists without the demo company."
            )

        with transaction.atomic():
            self._seed()
        self.stdout.write(self.style.SUCCESS("Demo data created."))
        self._print_logins()

    def _print_logins(self):
        self.stdout.write(f"  Founder:  {FOUNDER_EMAIL} / {PASSWORD}")
        self.stdout.write(f"  Employee: {EMPLOYEE_EMAIL} / {PASSWORD}")

    def _seed(self):
        today = timezone.localdate()
        now = timezone.now()
        founder = register_founder(
            email=FOUNDER_EMAIL,
            password=PASSWORD,
            first_name="Awa",
            last_name="Démo",
            company_name=COMPANY_NAME,
            country="CM",
        )
        company = founder.memberships.get().company
        company.legal_form = "SARL"
        company.tax_id = "M000000000000D"
        company.trade_register = "RC/DLA/2026/B/0000"
        company.address = "Rue fictive, Bonanjo, Douala"
        company.cash_alert_threshold = Decimal(1500000)
        company.save()
        employee = User.objects.create_user(
            email=EMPLOYEE_EMAIL, password=PASSWORD, first_name="Paul", last_name="Démo"
        )
        Membership.objects.create(user=employee, company=company, role=Membership.Role.EMPLOYEE)

        def client(name, status, city, **extra):
            return Client.objects.create(
                company=company, name=name, status=status, city=city, country="CM", **extra
            )

        hotel = client(
            "Hôtel Akwa Palace (démo)",
            "active",
            "Douala",
            contact_name="M. Ndongo",
            phone="+237 600 00 00 01",
        )
        pharmacy = client("Pharmacie du Centre (démo)", "active", "Yaoundé")
        bakery = client(
            "Boulangerie du Littoral (démo)",
            "active",
            "Douala",
            contact_name="Jean Mbarga",
            phone="+237 600 00 00 02",
        )
        garage = client("Garage Bonabéri (démo)", "active", "Douala")
        restaurant = client("Restaurant Le Wouri (démo)", "prospect", "Douala")
        client("Supermarché du Port (démo)", "prospect", "Douala")

        def talk(who, kind, days_ago, summary):
            Interaction.objects.create(
                client=who,
                kind=kind,
                occurred_at=now - timedelta(days=days_ago),
                summary=summary,
                created_by=founder,
            )

        talk(hotel, "call", 12, "Le comptable promet un virement la semaine prochaine.")
        talk(bakery, "meeting", 3, "Satisfait des livraisons, envisage un contrat mensuel.")
        talk(restaurant, "meeting", 9, "Intéressé par une livraison quotidienne, demande un devis.")
        talk(garage, "call", 95, "Commande ponctuelle.")

        # US-05 follow-ups: one late, one for today, one later, for "Ma journée".
        def follow(who, reason, days, channel):
            follow_up = crm_services.plan_follow_up(
                client=who, user=founder, due_date=today, reason=reason, channel=channel
            )
            # Planning in the past is refused: move the demo date afterwards.
            FollowUp.objects.filter(pk=follow_up.pk).update(due_date=today + timedelta(days=days))

        follow(hotel, "Rappeler le comptable pour le virement promis", -2, "call")
        follow(restaurant, "Envoyer le devis de livraison quotidienne", 0, "whatsapp")
        follow(bakery, "Proposer le contrat mensuel", 5, "meeting")

        def invoice(who, description, quantity, price, *, issued_days_ago, due_in, exempt=False):
            line = {
                "description": description,
                "quantity": Decimal(quantity),
                "unit_price": Decimal(price),
                "tax_rate_code": "exempt" if exempt else "standard",
            }
            draft = billing.create_invoice(
                company=company,
                client=who,
                lines=[line],
                due_date=today - timedelta(days=issued_days_ago) + timedelta(days=due_in),
            )
            return billing.issue_invoice(draft, today=today - timedelta(days=issued_days_ago))

        def pay(inv, amount, days_ago, method):
            billing.record_payment(
                inv,
                amount=Decimal(amount),
                paid_on=today - timedelta(days=days_ago),
                method=method,
                user=founder,
            )

        # Overdue and partly paid: the advisor's first debtor.
        late = invoice(
            hotel, "Livraison de pain, septembre", 30, 10000, issued_days_ago=68, due_in=30
        )
        pay(late, 100000, 15, "mtn_momo")
        # Paid ten days late.
        paid = invoice(pharmacy, "Prestation", 1, 150000, issued_days_ago=50, due_in=15)
        pay(paid, paid.total, 25, "bank_transfer")
        # Not due yet.
        invoice(bakery, "Pains spéciaux, novembre", 1, 55000, issued_days_ago=5, due_in=30)
        invoice(pharmacy, "Prestation", 1, 80000, issued_days_ago=10, due_in=30)
        # Issued by mistake, cancelled by a credit note.
        wrong = invoice(bakery, "Commande annulée", 1, 20000, issued_days_ago=8, due_in=30)
        billing.create_credit_note(wrong, reason="Commande annulée par le client", user=founder)
        # A draft still being written.
        billing.create_invoice(
            company=company,
            client=restaurant,
            lines=[
                {
                    "description": "Devis : livraison quotidienne",
                    "quantity": Decimal(30),
                    "unit_price": Decimal(8500),
                }
            ],
        )

        def cash(direction, category, amount, days_ago, label, method="cash"):
            return billing.record_cash_movement(
                company=company,
                direction=direction,
                category=category,
                amount=Decimal(amount),
                occurred_on=today - timedelta(days=days_ago),
                method=method,
                label=label,
                user=founder,
            )

        cash("in", "opening_balance", 900000, 60, "Solde de départ (caisse et Mobile Money)")
        cash("out", "rent", 150000, min(today.day - 1, 3), "Loyer du mois")
        cash("out", "supplies", 220000, min(today.day - 1, 2), "Farine et levure")
        mistake = cash("out", "transport", 9999, 0, "Transport livraison", method="orange_money")
        billing.reverse_cash_movement(mistake, reason="Montant mal saisi", user=founder)
