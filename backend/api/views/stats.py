from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.models import Challenge, Submission

User = get_user_model()


@api_view(["GET"])
def platform_stats(request):
    return Response({
        "active_challenges": Challenge.objects.filter(is_active=True).count(),
        "total_submissions": Submission.objects.count(),
        "registered_users": User.objects.count(),
    })
