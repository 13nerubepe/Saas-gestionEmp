from django.contrib import admin

from advisor.models import AdvisorExchange


@admin.register(AdvisorExchange)
class AdvisorExchangeAdmin(admin.ModelAdmin):
    """Read-only: the exchanges are the log of what the agent said."""

    list_display = ["created_at", "kind", "company", "user", "confidence", "model_name"]
    list_filter = ["kind", "confidence"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
