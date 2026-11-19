from django.db.models import Count, F, Max, OuterRef, Q, Subquery
from django.utils import timezone

from crm.models import Client, FollowUp, Interaction


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
        interaction_count=Count("interactions", distinct=True),
        last_interaction_at=Max("interactions__occurred_at"),
        next_follow_up_date=_next_follow_up(),
    ).order_by("name", "id")


def _next_follow_up():
    """Date of the client's earliest open follow-up (a subquery: no row multiplication)."""
    return Subquery(
        FollowUp.objects.filter(client=OuterRef("pk"), status=FollowUp.Status.OPEN)
        .order_by("due_date")
        .values("due_date")[:1]
    )


def _with_last_interaction(queryset):
    latest = Interaction.objects.filter(client=OuterRef("pk")).order_by(
        "-occurred_at", "-created_at"
    )
    return queryset.annotate(
        interaction_count=Count("interactions"),
        last_interaction_at=Max("interactions__occurred_at"),
        last_interaction_kind=Subquery(latest.values("kind")[:1]),
        last_interaction_summary=Subquery(latest.values("summary")[:1]),
        next_follow_up_date=_next_follow_up(),
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


def follow_ups(queryset, *, client_id=None, due=None, today=None):
    """Follow-ups, open ones first, earliest first.

    `due`: "today" (open, due today or late), "overdue" (open, late),
    "upcoming" (open, from tomorrow), "done". None: all.
    """
    today = today or timezone.localdate()
    if client_id:
        queryset = queryset.filter(client_id=client_id)
    open_ = Q(status=FollowUp.Status.OPEN)
    filters = {
        "today": open_ & Q(due_date__lte=today),
        "overdue": open_ & Q(due_date__lt=today),
        "upcoming": open_ & Q(due_date__gt=today),
        "done": Q(status=FollowUp.Status.DONE),
    }
    if due in filters:
        queryset = queryset.filter(filters[due])
    return queryset.select_related("client").order_by(
        F("status").desc(), "due_date", "created_at", "id"
    )
