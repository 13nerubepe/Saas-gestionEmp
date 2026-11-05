import logging

from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from accounts.tenancy import COMPANY_HEADER_PARAMETER, CompanyScopedMixin, IsCompanyFounder
from advisor.models import AdvisorExchange
from advisor.serializers import (
    AdvisorExchangeSerializer,
    AskAdvisorSerializer,
    ReminderRequestSerializer,
)
from advisor.services import ask_advisor, draft_payment_reminder
from agents.llm import LLMUnavailable
from agents.views import AIServiceUnavailable
from billing.models import Invoice

logger = logging.getLogger(__name__)


@extend_schema(tags=["advisor"], parameters=[COMPANY_HEADER_PARAMETER])
class AdvisorQuestionsView(CompanyScopedMixin, generics.ListAPIView):
    """GET: the founder's past questions, newest first. POST: ask a new one.

    Founders only: the advisor sees every invoice and payment of the company.
    """

    permission_classes = [IsCompanyFounder]
    queryset = AdvisorExchange.objects.filter(kind=AdvisorExchange.Kind.QUESTION)
    serializer_class = AdvisorExchangeSerializer
    throttle_scope = "llm"

    def get_throttles(self):
        # The model is only called on POST: reading the history is not limited.
        return [ScopedRateThrottle()] if self.request.method == "POST" else []

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    @extend_schema(request=AskAdvisorSerializer, responses={201: AdvisorExchangeSerializer})
    def post(self, request):
        serializer = AskAdvisorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            exchange = ask_advisor(
                membership=request.membership, question=serializer.validated_data["question"]
            )
        except LLMUnavailable as exc:
            logger.warning("Advisor question failed, LLM unavailable: %s", exc)
            raise AIServiceUnavailable() from exc
        return Response(AdvisorExchangeSerializer(exchange).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["advisor"], parameters=[COMPANY_HEADER_PARAMETER])
class PaymentReminderView(CompanyScopedMixin, generics.GenericAPIView):
    """Draft a payment reminder for an unpaid invoice. Nothing is sent."""

    permission_classes = [IsCompanyFounder]
    queryset = Invoice.objects.select_related("client", "company")
    serializer_class = ReminderRequestSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "llm"

    @extend_schema(request=ReminderRequestSerializer, responses={201: AdvisorExchangeSerializer})
    def post(self, request, pk):
        invoice = self.get_object()  # another company's invoice is a 404
        serializer = ReminderRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            exchange = draft_payment_reminder(
                membership=request.membership, invoice=invoice, **serializer.validated_data
            )
        except LLMUnavailable as exc:
            logger.warning("Reminder draft failed, LLM unavailable: %s", exc)
            raise AIServiceUnavailable() from exc
        return Response(AdvisorExchangeSerializer(exchange).data, status=status.HTTP_201_CREATED)
