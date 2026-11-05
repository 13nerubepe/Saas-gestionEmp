from django.urls import path
from rest_framework.routers import SimpleRouter

from billing.views import (
    ClientFinancialsView,
    FinancialSummaryView,
    InvoiceViewSet,
    InvoicingRulesView,
)

router = SimpleRouter()
router.register("invoices", InvoiceViewSet, basename="invoice")

urlpatterns = [
    *router.urls,
    path("rules/", InvoicingRulesView.as_view(), name="invoicing-rules"),
    path("summary/", FinancialSummaryView.as_view(), name="financial-summary"),
    path("clients/<uuid:pk>/financials/", ClientFinancialsView.as_view(), name="client-financials"),
]
