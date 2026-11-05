from django.urls import path
from rest_framework.routers import SimpleRouter

from billing.views import InvoiceViewSet, InvoicingRulesView

router = SimpleRouter()
router.register("invoices", InvoiceViewSet, basename="invoice")

urlpatterns = [
    *router.urls,
    path("rules/", InvoicingRulesView.as_view(), name="invoicing-rules"),
]
