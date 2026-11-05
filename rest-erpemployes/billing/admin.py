from django.contrib import admin

from billing.models import Invoice, InvoiceLine


class InvoiceLineInline(admin.TabularInline):
    model = InvoiceLine
    extra = 0
    readonly_fields = ["subtotal", "tax_amount"]


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ["number", "client", "status", "total", "currency", "issue_date", "company"]
    list_filter = ["status"]
    search_fields = ["number", "client__name"]
    inlines = [InvoiceLineInline]
