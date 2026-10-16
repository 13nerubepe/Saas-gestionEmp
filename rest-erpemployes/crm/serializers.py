from rest_framework import serializers

from crm.models import Client, Interaction


class ClientSerializer(serializers.ModelSerializer):
    interaction_count = serializers.IntegerField(read_only=True, default=0)
    last_interaction_at = serializers.DateTimeField(read_only=True, allow_null=True, default=None)

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
