from django.urls import reverse

FRONTEND = "http://localhost:4200"


def test_preflight_allows_the_company_header_with_credentials(client, settings):
    settings.CORS_ALLOWED_ORIGINS = [FRONTEND]

    response = client.options(
        reverse("legal-question"),
        HTTP_ORIGIN=FRONTEND,
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="authorization, content-type, x-company-id",
    )

    assert response.headers["Access-Control-Allow-Origin"] == FRONTEND
    assert response.headers["Access-Control-Allow-Credentials"] == "true"
    allowed = response.headers["Access-Control-Allow-Headers"].lower()
    assert {"authorization", "content-type", "x-company-id"} <= {
        h.strip() for h in allowed.split(",")
    }
