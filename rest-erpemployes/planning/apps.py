from django.apps import AppConfig


class PlanningConfig(AppConfig):
    """M7, the founder's steering: "Ma journée" (US-06), then obligations (US-10).

    It reads crm and billing; neither of them reads it.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "planning"
