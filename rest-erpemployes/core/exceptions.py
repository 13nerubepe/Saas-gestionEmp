from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """DRF's handler, plus a stable `code` next to `detail`.

    The frontend translates errors from the code, so the message can change or
    be localised without breaking the client. Validation errors keep DRF's
    per-field format.
    """
    # Django's own exceptions (raised by get_object_or_404, for instance) have
    # no code: convert them the way DRF does internally.
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    response = drf_exception_handler(exc, context)
    if (
        response is not None
        and isinstance(exc, exceptions.APIException)
        and isinstance(response.data, dict)
        and "detail" in response.data
    ):
        codes = exc.get_codes()
        if isinstance(codes, str):
            response.data["code"] = codes
    return response
