from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from accounts.models import Membership, User


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    first_name = serializers.CharField(max_length=150, default="", allow_blank=True)
    last_name = serializers.CharField(max_length=150, default="", allow_blank=True)
    language = serializers.ChoiceField(choices=settings.LANGUAGES, default="fr")
    company_name = serializers.CharField(max_length=255)
    country = serializers.CharField(
        min_length=2, max_length=2, default="CM", help_text="ISO 3166-1 alpha-2"
    )

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                _("A user with this email already exists."), code="email_taken"
            )
        return value

    def validate_country(self, value):
        return value.upper()

    def validate(self, attrs):
        # Runs the AUTH_PASSWORD_VALIDATORS from settings, which Django only
        # applies on its own in forms and createsuperuser.
        user = User(
            email=attrs["email"], first_name=attrs["first_name"], last_name=attrs["last_name"]
        )
        try:
            validate_password(attrs["password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs


class LoginSerializer(serializers.Serializer):
    """Documentation only: the actual validation is simplejwt's."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})


class AccessTokenSerializer(serializers.Serializer):
    access = serializers.CharField(
        help_text="JWT to send as `Authorization: Bearer <token>`. Short-lived."
    )


class MembershipSerializer(serializers.ModelSerializer):
    company_id = serializers.UUIDField(source="company.id", read_only=True)
    company_name = serializers.CharField(source="company.name", read_only=True)
    country = serializers.CharField(source="company.country", read_only=True)

    class Meta:
        model = Membership
        fields = ["company_id", "company_name", "country", "role"]


class UserSerializer(serializers.ModelSerializer):
    memberships = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "language", "memberships"]
        read_only_fields = ["id", "email"]

    @extend_schema_field(MembershipSerializer(many=True))
    def get_memberships(self, user):
        active = user.memberships.filter(is_active=True).select_related("company")
        return MembershipSerializer(active, many=True).data
