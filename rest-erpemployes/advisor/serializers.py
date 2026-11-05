from django.utils import translation
from django.utils.translation import gettext as _
from django.utils.translation import gettext_noop
from rest_framework import serializers

from advisor.models import AdvisorExchange

# Added by the application, never generated: always present, translated.
ADVISOR_DISCLAIMER = gettext_noop(
    "Advice based on the data recorded in the application today. It does not "
    "replace a chartered accountant."
)
REFERRAL = gettext_noop(
    "The data does not answer this question with certainty. Before an important "
    "decision, ask a chartered accountant (expert-comptable)."
)


class AskAdvisorSerializer(serializers.Serializer):
    question = serializers.CharField(min_length=3, max_length=2000)


class ReminderRequestSerializer(serializers.Serializer):
    channel = serializers.ChoiceField(choices=["whatsapp", "email"])
    tone = serializers.ChoiceField(choices=["friendly", "firm"], default="friendly")


class CitedFactSerializer(serializers.Serializer):
    number = serializers.IntegerField()
    topic = serializers.CharField()
    text = serializers.CharField()
    link_type = serializers.CharField(allow_blank=True)
    link_id = serializers.CharField(allow_blank=True)


class AdvisorExchangeSerializer(serializers.ModelSerializer):
    sources = CitedFactSerializer(source="cited_facts", many=True)
    invoice_id = serializers.UUIDField(allow_null=True)
    disclaimer = serializers.SerializerMethodField()
    referral_text = serializers.SerializerMethodField()

    class Meta:
        model = AdvisorExchange
        fields = [
            "id",
            "kind",
            "question",
            "invoice_id",
            "subject",
            "answer",
            "confidence",
            "referral",
            "referral_text",
            "sources",
            "disclaimer",
            "model_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_disclaimer(self, exchange) -> str:
        with translation.override(exchange.language):
            return _(ADVISOR_DISCLAIMER)

    def get_referral_text(self, exchange) -> str:
        if not exchange.referral:
            return ""
        with translation.override(exchange.language):
            return _(REFERRAL)
