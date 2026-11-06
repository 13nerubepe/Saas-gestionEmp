from django.urls import path
from rest_framework.routers import SimpleRouter

from billing.views import (
    CashMovementListView,
    CashMovementReversalView,
    ClientFinancialsView,
    FinancialSummaryView,
    InvoiceViewSet,
    InvoicingRulesView,
    PaymentReversalView,
)

router = SimpleRouter()
router.register("invoices", InvoiceViewSet, basename="invoice")

urlpatterns = [
    *router.urls,
    path("rules/", InvoicingRulesView.as_view(), name="invoicing-rules"),
    path("summary/", FinancialSummaryView.as_view(), name="financial-summary"),
    path("payments/<uuid:pk>/reverse/", PaymentReversalView.as_view(), name="payment-reverse"),
    path("cash-movements/", CashMovementListView.as_view(), name="cash-movements"),
    path(
        "cash-movements/<uuid:pk>/reverse/",
        CashMovementReversalView.as_view(),
        name="cash-movement-reverse",
    ),
    path("clients/<uuid:pk>/financials/", ClientFinancialsView.as_view(), name="client-financials"),
]
