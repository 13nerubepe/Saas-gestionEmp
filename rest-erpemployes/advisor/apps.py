from django.apps import AppConfig


class AdvisorConfig(AppConfig):
    """The financial and commercial advisor agent (M4, M5).

    A business app, not part of `agents`: it reads billing and crm data, and
    `agents` must never import business apps. It uses `agents.llm` like any
    other business app.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "advisor"
