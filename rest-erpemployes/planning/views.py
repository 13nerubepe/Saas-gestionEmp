from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.tenancy import COMPANY_HEADER_PARAMETER, IsCompanyMember
from planning.selectors import my_day
from planning.serializers import MyDaySerializer


@extend_schema(tags=["planning"], parameters=[COMPANY_HEADER_PARAMETER], responses=MyDaySerializer)
class MyDayView(APIView):
    """US-06: what the member should do today, in the active company."""

    permission_classes = [IsCompanyMember]

    def get(self, request):
        return Response(MyDaySerializer(my_day(request.membership)).data)
