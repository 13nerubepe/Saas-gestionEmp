from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.tenancy import COMPANY_HEADER_PARAMETER, CompanyScopedMixin, IsCompanyFounder
from billing import services
from billing.models import Invoice
from billing.rules import rules_for
from billing.selectors import filter_invoices
from billing.serializers import (
    InvoiceSerializer,
    InvoiceWriteSerializer,
    InvoicingRulesSerializer,
)

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
)
@extend_schema(tags=["billing"])
class InvoiceViewSet(CompanyScopedMixin, viewsets.ModelViewSet):
    """US-14: the company's invoices. Founders only: invoicing is about money."""

    permission_classes = [IsCompanyFounder]
    queryset = Invoice.objects.prefetch_related("lines")
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
