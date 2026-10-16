from django.db.models import Count, Max, Q


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
