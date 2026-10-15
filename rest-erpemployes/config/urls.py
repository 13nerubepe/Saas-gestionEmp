"""
URL configuration for config project.

Every API route lives under /api/v1/. Each app exposes its own urls.py and is
included in api_v1_patterns below.
"""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api_v1_patterns = [
    path("", include("core.urls")),
    path("auth/", include("accounts.urls")),
    path("agents/", include("agents.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1_patterns)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
