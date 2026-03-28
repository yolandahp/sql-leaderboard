from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def leaderboard(request):
    # Placeholder — will be implemented with scoring
    return Response([])


@api_view(["GET"])
def challenge_leaderboard(request, pk):
    # Placeholder — will be implemented with scoring
    return Response([])
