from django.urls import path
from rest_framework.routers import SimpleRouter

from crm.views import ClientInteractionsView, ClientViewSet

router = SimpleRouter()
router.register("clients", ClientViewSet, basename="client")

urlpatterns = [
    *router.urls,
    path(
        "clients/<uuid:client_id>/interactions/",
        ClientInteractionsView.as_view(),
        name="client-interactions",
    ),
]
