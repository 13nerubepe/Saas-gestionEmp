from django.conf import settings
from pgvector.django import CosineDistance

from agents.models import LegalReference


def search_legal_references(*, embedding, jurisdictions, limit=5, max_distance=None):
    """The passages closest to `embedding`, restricted to `jurisdictions`.

    Passages further than `max_distance` are dropped: an empty result means the
    loaded texts do not cover the question.
    """
    if max_distance is None:
        max_distance = settings.LEGAL_SEARCH_MAX_DISTANCE
    return list(
        LegalReference.objects.filter(jurisdiction__in=jurisdictions, embedding__isnull=False)
        .annotate(distance=CosineDistance("embedding", embedding))
        .filter(distance__lte=max_distance)
        .order_by("distance")[:limit]
    )
