from django.contrib import admin

from billing.models import Invoice, InvoiceLine, Payment


class InvoiceLineInline(admin.TabularInline):
    model = InvoiceLine
    extra = 0
    readonly_fields = ["subtotal", "tax_amount"]


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    can_delete = False
    readonly_fields = ["amount", "paid_on", "method", "reference", "created_by"]

    def has_add_permission(self, request, obj=None):
        return False  # through the app only: record_payment keeps the invoice balance


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ["number", "client", "status", "total", "currency", "issue_date", "company"]
    list_filter = ["status"]
    search_fields = ["number", "client__name"]
    inlines = [InvoiceLineInline, PaymentInline]
