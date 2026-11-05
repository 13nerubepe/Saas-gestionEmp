from django.urls import path

from advisor.views import AdvisorQuestionsView, PaymentReminderView

urlpatterns = [
    path("questions/", AdvisorQuestionsView.as_view(), name="advisor-questions"),
    path("invoices/<uuid:pk>/reminder/", PaymentReminderView.as_view(), name="payment-reminder"),
]
