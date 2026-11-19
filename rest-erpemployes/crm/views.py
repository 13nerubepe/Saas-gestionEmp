from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.tenancy import (
    COMPANY_HEADER_PARAMETER,
    CompanyScopedMixin,
    IsCompanyFounder,
)
from crm import services
from crm.importing import MAX_BYTES, ImportFileError
from crm.models import Client, FollowUp
from crm.selectors import follow_ups, search_clients
from crm.serializers import (
    ClientImportRequestSerializer,
    ClientImportResultSerializer,
    ClientSerializer,
    CompleteFollowUpSerializer,
    FollowUpSerializer,
    InteractionSerializer,
    PostponeFollowUpSerializer,
)
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


DUE_PARAMETER = OpenApiParameter(
    "due",
    OpenApiTypes.STR,
    enum=["today", "overdue", "upcoming", "done"],
    description="today: open and due today or late. Omit for all.",
)


@extend_schema(tags=["crm"], parameters=[COMPANY_HEADER_PARAMETER, DUE_PARAMETER])
class ClientFollowUpsView(CompanyScopedMixin, generics.ListCreateAPIView):
    """US-05: a client's follow-ups (GET), plan a new one (POST)."""

    queryset = Client.objects.all()
    serializer_class = FollowUpSerializer

    def get_client(self):
        # Scoped by CompanyScopedMixin: another company's client is a 404.
        return get_object_or_404(super().get_queryset(), pk=self.kwargs["client_id"])

    def list(self, request, *args, **kwargs):
        client = self.get_client()
        rows = follow_ups(client.follow_ups.all(), due=request.query_params.get("due"))
        page = self.paginate_queryset(rows)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    def create(self, request, *args, **kwargs):
        client = self.get_client()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        follow_up = services.plan_follow_up(
            client=client, user=request.user, **serializer.validated_data
        )
        return Response(self.get_serializer(follow_up).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["crm"], parameters=[COMPANY_HEADER_PARAMETER, DUE_PARAMETER])
class FollowUpListView(CompanyScopedMixin, generics.ListAPIView):
    """US-05/US-06: the company's follow-ups, e.g. ?due=today for "Ma journée"."""

    queryset = FollowUp.objects.all()
    serializer_class = FollowUpSerializer

    def get_queryset(self):
        return follow_ups(super().get_queryset(), due=self.request.query_params.get("due"))


class FollowUpActionView(CompanyScopedMixin, generics.GenericAPIView):
    queryset = FollowUp.objects.select_related("client")


@extend_schema(
    tags=["crm"],
    parameters=[COMPANY_HEADER_PARAMETER],
    request=CompleteFollowUpSerializer,
    responses=FollowUpSerializer,
)
class CompleteFollowUpView(FollowUpActionView):
    """Mark the follow-up as done; the summary joins the client's history."""

    serializer_class = CompleteFollowUpSerializer

    def post(self, request, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        follow_up = services.complete_follow_up(
            self.get_object(), user=request.user, **serializer.validated_data
        )
        return Response(FollowUpSerializer(follow_up).data)


@extend_schema(
    tags=["crm"],
    parameters=[COMPANY_HEADER_PARAMETER],
    request=PostponeFollowUpSerializer,
    responses=FollowUpSerializer,
)
class PostponeFollowUpView(FollowUpActionView):
    """Move the follow-up to another day."""

    serializer_class = PostponeFollowUpSerializer

    def post(self, request, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        follow_up = services.postpone_follow_up(self.get_object(), **serializer.validated_data)
        return Response(FollowUpSerializer(follow_up).data)


class ImportFileInvalid(APIException):
    """The file cannot be imported. The code says why: import_file_too_large,
    import_file_unreadable, import_file_empty, import_name_column_missing,
    import_too_many_rows."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "import_file_invalid"


@extend_schema(
    tags=["crm"],
    parameters=[COMPANY_HEADER_PARAMETER],
    request={"multipart/form-data": ClientImportRequestSerializer},
    responses=ClientImportResultSerializer,
)
class ClientImportView(APIView):
    """US-23: import contacts from a CSV. Check first (dry_run), then import."""

    permission_classes = [IsCompanyFounder]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = ClientImportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file = serializer.validated_data["file"]
        try:
            # Refuse a large file before reading it: it is never loaded into memory.
            if file.size > MAX_BYTES:
                raise ImportFileError(
                    "import_file_too_large", _("The file is too large (1 MB at most).")
                )
            result = services.import_clients(
                company=request.company,
                raw=file.read(MAX_BYTES + 1),
                dry_run=serializer.validated_data["dry_run"],
            )
        except ImportFileError as exc:
            raise ImportFileInvalid(str(exc), code=exc.code) from exc
        return Response(ClientImportResultSerializer(result).data)
