from django.utils import translation
from django.utils.translation import gettext as _
from django.utils.translation import gettext_noop
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from agents.models import Answer, Conversation, Source

# gettext_noop marks the text for translation; it is translated when used.
LEGAL_DISCLAIMER = gettext_noop(
    "This answer is general information based on the cited texts, not legal advice. "
    "Check with a lawyer before any important decision."
)


class AskLegalQuestionSerializer(serializers.Serializer):
    question = serializers.CharField(min_length=3, max_length=2000)
    conversation_id = serializers.UUIDField(
        required=False, help_text="Continue an existing conversation; omit to start a new one."
    )


class SourceSerializer(serializers.ModelSerializer):
    jurisdiction = serializers.CharField(source="legal_reference.jurisdiction")
    citation = serializers.CharField(source="legal_reference.citation")
    title = serializers.CharField(source="legal_reference.title")
    content = serializers.CharField(source="legal_reference.content")
    source_url = serializers.CharField(source="legal_reference.source_url")
    effective_date = serializers.DateField(source="legal_reference.effective_date")

    class Meta:
        model = Source
        fields = [
            "rank",
            "jurisdiction",
            "citation",
            "title",
            "content",
            "source_url",
            "effective_date",
        ]


class AnswerSerializer(serializers.ModelSerializer):
    conversation_id = serializers.UUIDField(source="query.conversation_id")
    question = serializers.CharField(source="query.text")
    answer = serializers.CharField(source="text")
    sources = SourceSerializer(many=True)
    disclaimer = serializers.SerializerMethodField()

    class Meta:
        model = Answer
        fields = [
            "id",
            "conversation_id",
            "question",
            "answer",
            "found_sources",
            "sources",
            "disclaimer",
            "created_at",
        ]
        read_only_fields = fields

    def get_disclaimer(self, answer) -> str:
        # Written by the application, never by the model: always present, always
        # the same, in the language the question was asked in.
        with translation.override(answer.query.language):
            return _(LEGAL_DISCLAIMER)


class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = ["id", "title", "created_at"]


class ConversationDetailSerializer(ConversationSerializer):
    exchanges = serializers.SerializerMethodField()

    class Meta(ConversationSerializer.Meta):
        fields = [*ConversationSerializer.Meta.fields, "exchanges"]

    @extend_schema_field(AnswerSerializer(many=True))
    def get_exchanges(self, conversation):
        answers = (
            Answer.objects.filter(query__conversation=conversation)
            .select_related("query")
            .prefetch_related("sources__legal_reference")
            .order_by("query__created_at")
        )
        return AnswerSerializer(answers, many=True).data
