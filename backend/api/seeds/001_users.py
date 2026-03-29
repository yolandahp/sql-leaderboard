from django.contrib.auth import get_user_model

User = get_user_model()

USERS = [
    {
        "username": "admin",
        "email": "admin@leaderboard.com",
        "password": "admin123",
        "is_superuser": True,
        "is_staff": True,
    },
    {
        "username": "user1",
        "email": "user1@leaderboard.com",
        "password": "user123",
        "is_superuser": False,
        "is_staff": False,
    },
    {
        "username": "user2",
        "email": "user2@leaderboard.com",
        "password": "user123",
        "is_superuser": False,
        "is_staff": False,
    },
    {
        "username": "user3",
        "email": "user3@leaderboard.com",
        "password": "user123",
        "is_superuser": False,
        "is_staff": False,
    },
]


def run(stdout, style):
    for data in USERS:
        if User.objects.filter(username=data["username"]).exists():
            stdout.write(f"  User '{data['username']}' already exists, skipping.")
            continue

        if data["is_superuser"]:
            User.objects.create_superuser(
                username=data["username"],
                email=data["email"],
                password=data["password"],
            )
        else:
            User.objects.create_user(
                username=data["username"],
                email=data["email"],
                password=data["password"],
            )

        role = "admin" if data["is_staff"] else "user"
        stdout.write(style.SUCCESS(
            f"  Created {role}: {data['username']} / {data['password']}"
        ))
