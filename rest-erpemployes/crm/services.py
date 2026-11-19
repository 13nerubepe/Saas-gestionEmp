from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers, status
from rest_framework.exceptions import APIException

from crm.models import FollowUp, Interaction


class FollowUpClosed(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = _("This follow-up is already done.")
    default_code = "follow_up_closed"


def record_interaction(*, client, user, kind, occurred_at, summary):
    """US-04: add an exchange to the client's history."""
    return Interaction.objects.create(
        client=client, kind=kind, occurred_at=occurred_at, summary=summary, created_by=user
    )


def _check_not_past(day):
    if day < timezone.localdate():
        raise serializers.ValidationError(
            {"due_date": [_("A follow-up cannot be planned in the past.")]}, code="date_in_past"
        )


def plan_follow_up(*, client, user, due_date, reason, channel=""):
    """US-05: remind the team to get back to a client on a given day."""
    _check_not_past(due_date)
    return FollowUp.objects.create(
        company=client.company,
        client=client,
        due_date=due_date,
        reason=reason,
        channel=channel,
        created_by=user,
    )


# How a follow-up channel is recorded in the client's history.
_INTERACTION_KIND = {
    FollowUp.Channel.CALL: Interaction.Kind.CALL,
    FollowUp.Channel.WHATSAPP: Interaction.Kind.MESSAGE,
    FollowUp.Channel.EMAIL: Interaction.Kind.EMAIL,
    FollowUp.Channel.MEETING: Interaction.Kind.MEETING,
}


@transaction.atomic
def complete_follow_up(follow_up, *, user, summary):
    """Close the follow-up and add what happened to the client's history."""
    follow_up = FollowUp.objects.select_for_update().get(pk=follow_up.pk)
    if follow_up.status != FollowUp.Status.OPEN:
        raise FollowUpClosed()
    now = timezone.now()
    follow_up.outcome = record_interaction(
        client=follow_up.client,
        user=user,
        kind=_INTERACTION_KIND.get(follow_up.channel, Interaction.Kind.NOTE),
        occurred_at=now,
        summary=f"{follow_up.reason} — {summary}",
    )
    follow_up.status = FollowUp.Status.DONE
    follow_up.done_at = now
    follow_up.save(update_fields=["outcome", "status", "done_at", "updated_at"])
    return follow_up


@transaction.atomic
def postpone_follow_up(follow_up, *, due_date):
    """Move the follow-up to another day; earlier dates stay in its history."""
    follow_up = FollowUp.objects.select_for_update().get(pk=follow_up.pk)
    if follow_up.status != FollowUp.Status.OPEN:
        raise FollowUpClosed()
    _check_not_past(due_date)
    follow_up.postponements = [
        *follow_up.postponements,
        {
            "from": follow_up.due_date.isoformat(),
            "to": due_date.isoformat(),
            "at": timezone.now().isoformat(),
        },
    ]
    follow_up.due_date = due_date
    follow_up.save(update_fields=["postponements", "due_date", "updated_at"])
    return follow_up
