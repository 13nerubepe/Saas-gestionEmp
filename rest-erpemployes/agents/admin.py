from django.contrib import admin

from agents.models import Answer, Conversation, LegalReference, Query, Source


@admin.register(LegalReference)
class LegalReferenceAdmin(admin.ModelAdmin):
    list_display = ["citation", "jurisdiction", "effective_date", "has_embedding"]
    list_filter = ["jurisdiction"]
    search_fields = ["citation", "title", "content"]
    # Vectors are computed by `load_legal_texts`, not typed by hand.
    exclude = ["embedding", "content_hash"]

    @admin.display(boolean=True)
    def has_embedding(self, obj):
        return obj.embedding is not None


class QueryInline(admin.TabularInline):
    model = Query
    extra = 0
    fields = ["text", "language", "created_at"]
    readonly_fields = fields


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["title", "user", "company", "created_at"]
    list_filter = ["company"]
    inlines = [QueryInline]


class SourceInline(admin.TabularInline):
    model = Source
    extra = 0
    fields = ["rank", "legal_reference", "distance"]
    readonly_fields = fields


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    """Read-only view to inspect what the agent answered and on which texts."""

    list_display = ["query", "found_sources", "model_name", "prompt_version", "created_at"]
    list_filter = ["found_sources", "model_name"]
    readonly_fields = ["query", "text", "found_sources", "model_name", "prompt_version"]
    inlines = [SourceInline]
