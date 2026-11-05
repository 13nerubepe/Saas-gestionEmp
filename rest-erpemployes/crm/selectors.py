from django.db.models import Count, F, Max, OuterRef, Q, Subquery

from crm.models import Client, Interaction


def search_clients(queryset, search):
    """Clients whose name, contact, email or phone contains `search`, with history stats."""
    if search:
        queryset = queryset.filter(
            Q(name__icontains=search)
            | Q(contact_name__icontains=search)
            | Q(email__icontains=search)
            | Q(phone__icontains=search)
        )
    # Explicit order: Meta.ordering is ignored once the query aggregates, and
    # pagination needs a stable order.
    return queryset.annotate(
        interaction_count=Count("interactions"),
        last_interaction_at=Max("interactions__occurred_at"),
    ).order_by("name", "id")


def _with_last_interaction(queryset):
    latest = Interaction.objects.filter(client=OuterRef("pk")).order_by(
        "-occurred_at", "-created_at"
    )
    return queryset.annotate(
        interaction_count=Count("interactions"),
        last_interaction_at=Max("interactions__occurred_at"),
        last_interaction_kind=Subquery(latest.values("kind")[:1]),
        last_interaction_summary=Subquery(latest.values("summary")[:1]),
    ).order_by(F("last_interaction_at").desc(nulls_last=True), "-created_at", "id")


def status_counts(company):
    """{"prospect": 4, "active": 10, "inactive": 1}, zero for missing statuses."""
    counts = dict.fromkeys(Client.Status.values, 0)
    rows = Client.objects.filter(company=company).values("status").annotate(n=Count("id"))
    counts.update({row["status"]: row["n"] for row in rows})
    return counts


def prospects_by_activity(company, *, limit=None):
    """Prospects, the most recently worked first, then those never contacted."""
    prospects = _with_last_interaction(
        Client.objects.filter(company=company, status=Client.Status.PROSPECT)
    )
    return list(prospects[:limit] if limit else prospects)


def dormant_clients(company, *, since, limit=None):
    """Active clients with no interaction since `since` (a datetime), longest silence first."""
    clients = (
        _with_last_interaction(Client.objects.filter(company=company, status=Client.Status.ACTIVE))
        .filter(Q(last_interaction_at__lt=since) | Q(last_interaction_at__isnull=True))
        .order_by(F("last_interaction_at").asc(nulls_first=True), "name")
    )
    return list(clients[:limit] if limit else clients)
