from django.urls import path

from agents.views import AskLegalQuestionView, ConversationDetailView, ConversationListView

urlpatterns = [
    path("legal/questions/", AskLegalQuestionView.as_view(), name="legal-question"),
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path("conversations/<uuid:pk>/", ConversationDetailView.as_view(), name="conversation-detail"),
]
