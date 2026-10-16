from django.contrib import admin

from crm.models import Client, Interaction


class InteractionInline(admin.TabularInline):
    model = Interaction
    extra = 0
    fields = ["occurred_at", "kind", "summary", "created_by"]
    readonly_fields = fields


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ["name", "company", "kind", "status", "email", "phone"]
    list_filter = ["company", "status", "kind"]
    search_fields = ["name", "contact_name", "email", "phone"]
    inlines = [InteractionInline]
