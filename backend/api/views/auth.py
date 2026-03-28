from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import AccessToken

from django.db.models import Count, Q

from api.models import Challenge, Submission
from api.serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    SubmissionSerializer,
)


@api_view(["POST"])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(
        username=serializer.validated_data["username"],
        password=serializer.validated_data["password"],
    )
    if user is None:
        return Response(
            {"detail": "Invalid username or password"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    token = AccessToken.for_user(user)
    return Response({"access_token": str(token), "token_type": "bearer"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_submissions(request):
    submissions = Submission.objects.filter(user=request.user)
    return Response(SubmissionSerializer(submissions, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_stats(request):
    user = request.user
    total_submissions = Submission.objects.filter(user=user).count()
    challenges_solved = (
        Submission.objects.filter(user=user, is_correct=True)
        .values("challenge_id")
        .distinct()
        .count()
    )
    total_challenges = Challenge.objects.filter(is_active=True).count()
    return Response({
        "total_submissions": total_submissions,
        "challenges_solved": challenges_solved,
        "total_challenges": total_challenges,
        "overall_rank": None,  # Will be computed when leaderboard is implemented
    })
