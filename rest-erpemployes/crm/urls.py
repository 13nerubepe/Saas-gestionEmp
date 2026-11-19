from django.urls import path
from rest_framework.routers import SimpleRouter

from crm.views import (
    ClientFollowUpsView,
    ClientImportView,
    ClientInteractionsView,
    ClientViewSet,
    CompleteFollowUpView,
    FollowUpListView,
    PostponeFollowUpView,
)

router = SimpleRouter()
# Before the router's clients/<pk>/: "import" is not a client id.
urlpatterns_first = [path("clients/import/", ClientImportView.as_view(), name="client-import")]
router.register("clients", ClientViewSet, basename="client")

urlpatterns = [
    *urlpatterns_first,
    *router.urls,
    path(
        "clients/<uuid:client_id>/interactions/",
        ClientInteractionsView.as_view(),
        name="client-interactions",
    ),
    path(
        "clients/<uuid:client_id>/follow-ups/",
        ClientFollowUpsView.as_view(),
        name="client-follow-ups",
    ),
    path("follow-ups/", FollowUpListView.as_view(), name="follow-ups"),
    path(
        "follow-ups/<uuid:pk>/complete/", CompleteFollowUpView.as_view(), name="follow-up-complete"
    ),
    path(
        "follow-ups/<uuid:pk>/postpone/", PostponeFollowUpView.as_view(), name="follow-up-postpone"
    ),
]
