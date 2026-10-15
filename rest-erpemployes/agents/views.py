import logging

from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.tenancy import COMPANY_HEADER_PARAMETER, CompanyScopedMixin, IsCompanyFounder
from agents.llm import LLMUnavailable
from agents.models import Answer, Conversation
from agents.serializers import (
    AnswerSerializer,
    AskLegalQuestionSerializer,
    ConversationDetailSerializer,
    ConversationSerializer,
)
from agents.services import ask_legal_question

logger = logging.getLogger(__name__)


class AIServiceUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = _("The AI service is temporarily unavailable. Try again later.")
    default_code = "llm_unavailable"


@extend_schema(tags=["agents"], parameters=[COMPANY_HEADER_PARAMETER])
class AskLegalQuestionView(APIView):
    """Ask a legal question; the answer cites the texts applicable to the company."""

    permission_classes = [IsCompanyFounder]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "llm"

    @extend_schema(request=AskLegalQuestionSerializer, responses={201: AnswerSerializer})
    def post(self, request):
        serializer = AskLegalQuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conversation = None
        if conversation_id := serializer.validated_data.get("conversation_id"):
            conversation = Conversation.objects.filter(
                id=conversation_id, company=request.company, user=request.user
            ).first()
            if conversation is None:
                raise NotFound()

        try:
            answer = ask_legal_question(
                membership=request.membership,
                question=serializer.validated_data["question"],
                conversation=conversation,
            )
        except LLMUnavailable as exc:
            logger.warning("Legal question failed, LLM unavailable: %s", exc)
            raise AIServiceUnavailable() from exc

        answer = (
            Answer.objects.select_related("query")
            .prefetch_related("sources__legal_reference")
            .get(pk=answer.pk)
        )
        return Response(AnswerSerializer(answer).data, status=status.HTTP_201_CREATED)


class OwnConversationsMixin(CompanyScopedMixin):
    """Conversations of the active company that belong to the current user."""

    queryset = Conversation.objects.all()

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)


@extend_schema(tags=["agents"], parameters=[COMPANY_HEADER_PARAMETER])
class ConversationListView(OwnConversationsMixin, generics.ListAPIView):
    serializer_class = ConversationSerializer


@extend_schema(tags=["agents"], parameters=[COMPANY_HEADER_PARAMETER])
class ConversationDetailView(OwnConversationsMixin, generics.RetrieveAPIView):
    serializer_class = ConversationDetailSerializer
