from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status, viewsets
from rest_framework.response import Response

from accounts.tenancy import COMPANY_HEADER_PARAMETER, CompanyScopedMixin
from crm.models import Client
from crm.selectors import search_clients
from crm.serializers import ClientSerializer, InteractionSerializer
from crm.services import record_interaction

SEARCH_PARAMETER = OpenApiParameter(
    "search", OpenApiTypes.STR, description="Matches name, contact, email or phone."
)


@extend_schema_view(
    list=extend_schema(parameters=[COMPANY_HEADER_PARAMETER, SEARCH_PARAMETER]),
    create=extend_schema(parameters=[COMPANY_HEADER_PARAMETER]),
    retrieve=extend_schema(parameters=[COMPANY_HEADER_PARAMETER]),
    update=extend_schema(parameters=[COMPANY_HEADER_PARAMETER]),
    partial_update=extend_schema(parameters=[COMPANY_HEADER_PARAMETER]),
    destroy=extend_schema(parameters=[COMPANY_HEADER_PARAMETER]),
)
@extend_schema(tags=["crm"])
class ClientViewSet(CompanyScopedMixin, viewsets.ModelViewSet):
    """US-03: client records of the active company."""

    queryset = Client.objects.all()
    serializer_class = ClientSerializer

    def get_queryset(self):
        return search_clients(super().get_queryset(), self.request.query_params.get("search"))


@extend_schema(tags=["crm"], parameters=[COMPANY_HEADER_PARAMETER])
class ClientInteractionsView(CompanyScopedMixin, generics.ListCreateAPIView):
    """US-04: a client's history, newest first. Interactions cannot be edited or deleted."""

    queryset = Client.objects.all()
    serializer_class = InteractionSerializer

    def get_client(self):
        # Scoped by CompanyScopedMixin: another company's client is a 404.
        return get_object_or_404(super().get_queryset(), pk=self.kwargs["client_id"])

    def list(self, request, *args, **kwargs):
        interactions = self.get_client().interactions.select_related("created_by")
        page = self.paginate_queryset(interactions)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    def create(self, request, *args, **kwargs):
        client = self.get_client()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        interaction = record_interaction(
            client=client, user=request.user, **serializer.validated_data
        )
        return Response(self.get_serializer(interaction).data, status=status.HTTP_201_CREATED)
