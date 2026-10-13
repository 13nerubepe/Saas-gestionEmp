from django.urls import reverse


def test_health_is_public(client):
    response = client.get(reverse("health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_schema_is_served(client):
    response = client.get(reverse("schema"))

    assert response.status_code == 200
    assert "/api/v1/health/" in response.content.decode()
