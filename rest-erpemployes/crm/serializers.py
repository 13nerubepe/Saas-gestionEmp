from django.utils import timezone
from rest_framework import serializers

from crm.models import Client, FollowUp, Interaction


class ClientSerializer(serializers.ModelSerializer):
    interaction_count = serializers.IntegerField(read_only=True, default=0)
    last_interaction_at = serializers.DateTimeField(read_only=True, allow_null=True, default=None)
    next_follow_up_date = serializers.DateField(read_only=True, allow_null=True, default=None)

    class Meta:
        model = Client
        fields = [
            "id",
            "name",
            "kind",
            "status",
            "contact_name",
            "email",
            "phone",
            "address",
            "city",
            "country",
            "tax_id",
            "notes",
            "interaction_count",
            "last_interaction_at",
            "next_follow_up_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_country(self, value):
        return value.upper()


class InteractionSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(
        source="created_by.email", read_only=True, allow_null=True, default=None
    )

    class Meta:
        model = Interaction
        fields = ["id", "kind", "occurred_at", "summary", "created_by_email", "created_at"]
        read_only_fields = ["id", "created_by_email", "created_at"]


class FollowUpSerializer(serializers.ModelSerializer):
    """Read side, and the fields set when a follow-up is planned."""

    client_id = serializers.UUIDField(read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    is_overdue = serializers.SerializerMethodField()
    outcome_summary = serializers.CharField(
        source="outcome.summary", read_only=True, allow_null=True, default=None
    )

    class Meta:
        model = FollowUp
        fields = [
            "id",
            "client_id",
            "client_name",
            "due_date",
            "reason",
            "channel",
            "status",
            "is_overdue",
            "postponements",
            "done_at",
            "outcome_summary",
            "created_at",
        ]
        read_only_fields = ["id", "status", "postponements", "done_at", "created_at"]

    def get_is_overdue(self, follow_up) -> bool:
        return (
            follow_up.status == FollowUp.Status.OPEN and follow_up.due_date < timezone.localdate()
        )


class CompleteFollowUpSerializer(serializers.Serializer):
    summary = serializers.CharField(min_length=2, max_length=2000)


class PostponeFollowUpSerializer(serializers.Serializer):
    due_date = serializers.DateField()


class ClientImportRequestSerializer(serializers.Serializer):
    file = serializers.FileField(help_text="CSV, comma or semicolon separated, 1 MB at most")
    dry_run = serializers.BooleanField(
        default=True, help_text="Check only: nothing is created. Send false to import."
    )


class ImportLineSerializer(serializers.Serializer):
    line = serializers.IntegerField()
    name = serializers.CharField(required=False)
    messages = serializers.ListField(child=serializers.CharField(), required=False)


class ClientImportResultSerializer(serializers.Serializer):
    dry_run = serializers.BooleanField()
    rows = serializers.IntegerField()
    new_count = serializers.IntegerField(help_text="Created, or to be created on a dry run")
    preview = serializers.ListField(child=serializers.CharField())
    skipped = ImportLineSerializer(many=True, help_text="Already in the client list")
    errors = ImportLineSerializer(many=True)
