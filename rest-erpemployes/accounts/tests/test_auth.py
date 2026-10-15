import pytest
from django.conf import settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import Membership, User

pytestmark = pytest.mark.django_db

EMAIL = "founder@example.com"
PASSWORD = "a-Strong-pass-42"
COOKIE = settings.REFRESH_COOKIE_NAME


def register(client=None, **overrides):
    payload = {"email": EMAIL, "password": PASSWORD, "company_name": "Acme"} | overrides
    return (client or APIClient()).post(reverse("register"), payload, format="json")


def login(client, email=EMAIL, password=PASSWORD):
    return client.post(reverse("login"), {"email": email, "password": password}, format="json")


@pytest.fixture
def client():
    client = APIClient()
    register(client)
    return client


# Registration


def test_register_creates_founder_and_company():
    response = register()

    assert response.status_code == 201
    assert "password" not in response.data
    membership = Membership.objects.get(user__email=EMAIL)
    assert membership.role == Membership.Role.FOUNDER
    assert (membership.company.name, membership.company.country) == ("Acme", "CM")
    assert response.data["memberships"][0]["company_name"] == "Acme"


def test_register_uppercases_country():
    register(country="sn")

    assert Membership.objects.get(user__email=EMAIL).company.country == "SN"


def test_register_rejects_duplicate_email_whatever_the_case():
    register()

    response = register(email="FOUNDER@example.com")

    assert response.status_code == 400
    assert "email" in response.data
    assert User.objects.count() == 1


def test_register_rejects_weak_password():
    response = register(password="123")

    assert response.status_code == 400
    assert "password" in response.data
    assert not User.objects.exists()


# Login, refresh, logout


def test_login_returns_access_token_and_sets_refresh_cookie(client):
    response = login(client)

    assert response.status_code == 200
    assert set(response.data) == {"access"}
    cookie = response.cookies[COOKIE]
    assert cookie["httponly"] is True
    assert cookie["path"] == settings.REFRESH_COOKIE_PATH


def test_login_rejects_wrong_password(client):
    response = login(client, password="wrong-password")

    assert response.status_code == 401
    assert COOKIE not in response.cookies


def test_refresh_uses_the_cookie_and_rotates_it(client):
    login(client)
    old_token = client.cookies[COOKIE].value

    response = client.post(reverse("refresh"))

    assert response.status_code == 200
    assert "access" in response.data
    assert client.cookies[COOKIE].value != old_token

    client.cookies[COOKIE] = old_token
    assert client.post(reverse("refresh")).status_code == 401


def test_refresh_without_cookie_is_rejected():
    response = APIClient().post(reverse("refresh"))

    assert response.status_code == 401
    assert response.data["code"] == "not_authenticated"


def test_logout_revokes_the_refresh_token(client):
    login(client)
    token = client.cookies[COOKIE].value

    response = client.post(reverse("logout"))

    assert response.status_code == 204
    assert response.cookies[COOKIE]["max-age"] == 0
    client.cookies[COOKIE] = token
    assert client.post(reverse("refresh")).status_code == 401


# Current user


def test_me_requires_a_token():
    response = APIClient().get(reverse("me"))

    assert response.status_code == 401


def test_me_returns_profile_and_companies(client):
    access = login(client).data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = client.get(reverse("me"))

    assert response.status_code == 200
    assert response.data["email"] == EMAIL
    assert [m["role"] for m in response.data["memberships"]] == ["founder"]


def test_me_updates_language_but_not_email(client):
    access = login(client).data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = client.patch(
        reverse("me"), {"language": "en", "email": "other@example.com"}, format="json"
    )

    assert response.status_code == 200
    user = User.objects.get()
    assert (user.language, user.email) == ("en", EMAIL)
