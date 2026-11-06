from crm.models import Interaction


def record_interaction(*, client, user, kind, occurred_at, summary):
    """US-04: add an exchange to the client's history."""
    return Interaction.objects.create(
        client=client, kind=kind, occurred_at=occurred_at, summary=summary, created_by=user
    )
