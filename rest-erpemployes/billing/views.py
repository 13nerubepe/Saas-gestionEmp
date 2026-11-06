from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.tenancy import COMPANY_HEADER_PARAMETER, CompanyScopedMixin, IsCompanyFounder
from billing import services
from billing.models import CashMovement, Invoice, Payment
from billing.rules import rules_for
from billing.selectors import (
    cash_position,
    client_financials,
    filter_invoices,
    financial_summary,
    receivables_by_client,
)
from billing.serializers import (
    CashMovementSerializer,
    ClientFinancialsSerializer,
    FinancialSummarySerializer,
    InvoiceSerializer,
    InvoiceWriteSerializer,
    InvoicingRulesSerializer,
    PaymentSerializer,
    PaymentWriteSerializer,
    ReasonSerializer,
)
from crm.models import Client

LIST_PARAMETERS = [
    COMPANY_HEADER_PARAMETER,
    OpenApiParameter("status", OpenApiTypes.STR, enum=Invoice.Status.values),
    OpenApiParameter("client", OpenApiTypes.UUID),
    OpenApiParameter("overdue", OpenApiTypes.BOOL, description="Issued and past due."),
]
WRITE_SCHEMA = {
    "parameters": [COMPANY_HEADER_PARAMETER],
    "request": InvoiceWriteSerializer,
    "responses": InvoiceSerializer,
}


@extend_schema_view(
    list=extend_schema(parameters=LIST_PARAMETERS),
    retrieve=extend_schema(parameters=[COMPANY_HEADER_PARAMETER]),
    create=extend_schema(**WRITE_SCHEMA),
    update=extend_schema(**WRITE_SCHEMA),
    destroy=extend_schema(parameters=[COMPANY_HEADER_PARAMETER]),
    issue=extend_schema(parameters=[COMPANY_HEADER_PARAMETER], request=None),
    credit_note=extend_schema(
        parameters=[COMPANY_HEADER_PARAMETER],
        request=ReasonSerializer,
        responses={201: InvoiceSerializer},
    ),
    payments=extend_schema(
        parameters=[COMPANY_HEADER_PARAMETER],
        request=PaymentWriteSerializer,
        responses=InvoiceSerializer,
    ),
)
@extend_schema(tags=["billing"])
class InvoiceViewSet(CompanyScopedMixin, viewsets.ModelViewSet):
    """US-14: the company's invoices. Founders only: invoicing is about money."""

    permission_classes = [IsCompanyFounder]
    queryset = Invoice.objects.select_related("credited_invoice", "credit_note").prefetch_related(
        "lines", "payments__reversal"
    )
    serializer_class = InvoiceSerializer
    # A draft is replaced as a whole (PUT): no PATCH.
    http_method_names = ["get", "post", "put", "delete", "head", "options"]

    def get_queryset(self):
        params = self.request.query_params
        return filter_invoices(
            super().get_queryset(),
            status=params.get("status"),
            client_id=params.get("client"),
            overdue=params.get("overdue") in ("1", "true"),
        )

    def _write_data(self):
        serializer = InvoiceWriteSerializer(
            data=self.request.data, context={"request": self.request}
        )
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    def create(self, request, *args, **kwargs):
        invoice = services.create_invoice(company=request.company, **self._write_data())
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        invoice = services.update_invoice(self.get_object(), **self._write_data())
        return Response(InvoiceSerializer(invoice).data)

    def destroy(self, request, *args, **kwargs):
        services.delete_invoice(self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        """Give the draft its number and freeze it."""
        invoice = services.issue_invoice(self.get_object())
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="credit-note")
    def credit_note(self, request, pk=None):
        """Cancel the issued invoice with a credit note; returns the credit note."""
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = services.create_credit_note(
            self.get_object(), user=request.user, **serializer.validated_data
        )
        note = self.get_queryset().get(pk=note.pk)
        return Response(InvoiceSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def payments(self, request, pk=None):
        """US-15: record a payment; returns the invoice with its new balance."""
        invoice = self.get_object()
        serializer = PaymentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.record_payment(invoice, user=request.user, **serializer.validated_data)
        invoice = self.get_queryset().get(pk=invoice.pk)
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=["billing"], parameters=[COMPANY_HEADER_PARAMETER], responses=InvoicingRulesSerializer
)
class InvoicingRulesView(APIView):
    """Currency and VAT rates that apply to the active company's invoices."""

    permission_classes = [IsCompanyFounder]

    def get(self, request):
        country = request.company.country
        rules = rules_for(country)
        if rules is None:
            raise services.InvoicingNotAvailable()
        data = {"country": country, **vars(rules)}
        return Response(InvoicingRulesSerializer(data).data)


# How many debtors the summary lists; the advisor and the screen need the top ones.
RECEIVABLES_LIMIT = 20


@extend_schema(
    tags=["billing"], parameters=[COMPANY_HEADER_PARAMETER], responses=FinancialSummarySerializer
)
class FinancialSummaryView(APIView):
    """US-15/US-17: invoiced, collected, owed and overdue, and who owes what."""

    permission_classes = [IsCompanyFounder]

    def get(self, request):
        company = request.company
        rules = rules_for(company.country)
        receivables = receivables_by_client(company)
        data = {
            **financial_summary(company),
            "currency": rules.currency if rules else company.currency,
            "receivables": receivables[:RECEIVABLES_LIMIT],
            "receivables_count": len(receivables),
            "cash": cash_position(company),
        }
        return Response(FinancialSummarySerializer(data).data)


@extend_schema(
    tags=["billing"], parameters=[COMPANY_HEADER_PARAMETER], responses=ClientFinancialsSerializer
)
class ClientFinancialsView(CompanyScopedMixin, generics.GenericAPIView):
    """One client's account: invoiced, paid, owed, overdue, payment delay."""

    permission_classes = [IsCompanyFounder]
    queryset = Client.objects.all()
    serializer_class = ClientFinancialsSerializer

    def get(self, request, pk):
        client = self.get_object()  # another company's client is a 404
        rules = rules_for(request.company.country)
        data = {
            **client_financials(client),
            "currency": rules.currency if rules else request.company.currency,
        }
        return Response(ClientFinancialsSerializer(data).data)


@extend_schema(
    tags=["billing"],
    parameters=[COMPANY_HEADER_PARAMETER],
    request=ReasonSerializer,
    responses={201: PaymentSerializer},
)
class PaymentReversalView(CompanyScopedMixin, generics.GenericAPIView):
    """Cancel a payment entered by mistake: a reversing payment is added."""

    permission_classes = [IsCompanyFounder]
    queryset = Payment.objects.all()
    serializer_class = ReasonSerializer

    def post(self, request, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reversal = services.reverse_payment(
            self.get_object(), user=request.user, **serializer.validated_data
        )
        return Response(PaymentSerializer(reversal).data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    list=extend_schema(
        parameters=[
            COMPANY_HEADER_PARAMETER,
            OpenApiParameter("direction", OpenApiTypes.STR, enum=CashMovement.Direction.values),
        ]
    ),
    create=extend_schema(parameters=[COMPANY_HEADER_PARAMETER]),
)
@extend_schema(tags=["billing"])
class CashMovementListView(CompanyScopedMixin, generics.ListCreateAPIView):
    """Money in and out that is not an invoice payment, newest first."""

    permission_classes = [IsCompanyFounder]
    queryset = CashMovement.objects.select_related("reversal")
    serializer_class = CashMovementSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if direction := self.request.query_params.get("direction"):
            queryset = queryset.filter(direction=direction)
        return queryset.order_by("-occurred_on", "-created_at", "id")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movement = services.record_cash_movement(
            company=request.company, user=request.user, **serializer.validated_data
        )
        return Response(self.get_serializer(movement).data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=["billing"],
    parameters=[COMPANY_HEADER_PARAMETER],
    request=ReasonSerializer,
    responses={201: CashMovementSerializer},
)
class CashMovementReversalView(CompanyScopedMixin, generics.GenericAPIView):
    """Cancel a cash movement entered by mistake: a reversing movement is added."""

    permission_classes = [IsCompanyFounder]
    queryset = CashMovement.objects.all()
    serializer_class = ReasonSerializer

    def post(self, request, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reversal = services.reverse_cash_movement(
            self.get_object(), user=request.user, **serializer.validated_data
        )
        return Response(CashMovementSerializer(reversal).data, status=status.HTTP_201_CREATED)
