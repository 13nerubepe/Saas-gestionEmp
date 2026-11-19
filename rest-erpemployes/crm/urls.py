from django.urls import path
from rest_framework.routers import SimpleRouter

from crm.views import (
    ClientFollowUpsView,
    ClientInteractionsView,
    ClientViewSet,
    CompleteFollowUpView,
    FollowUpListView,
    PostponeFollowUpView,
)

router = SimpleRouter()
router.register("clients", ClientViewSet, basename="client")

urlpatterns = [
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
