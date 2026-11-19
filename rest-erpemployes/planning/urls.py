from django.urls import path

from planning.views import MyDayView

urlpatterns = [
    path("my-day/", MyDayView.as_view(), name="my-day"),
]
