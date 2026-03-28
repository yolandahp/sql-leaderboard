from django.urls import path

from . import views

urlpatterns = [
    # Auth
    path("auth/register", views.register),
    path("auth/login", views.login),
    path("auth/me", views.me),
    path("auth/me/submissions", views.my_submissions),
    path("auth/me/stats", views.my_stats),

    # Challenges
    path("challenges", views.challenge_list),
    path("challenges/<int:pk>", views.challenge_detail),
    path("challenges/<int:pk>/admin", views.challenge_admin_detail),

    # Stats
    path("stats", views.platform_stats),

    # Submissions
    path("submissions", views.submit_query),

    # Leaderboard
    path("leaderboard", views.leaderboard),
    path("leaderboard/challenge/<int:pk>", views.challenge_leaderboard),
]
