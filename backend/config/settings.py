import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ["JWT_SECRET"]

DEBUG = os.environ.get("DEBUG", "1") == "1"

ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "rest_framework",
    "corsheaders",
    "api",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["DB_NAME"],
        "USER": os.environ["DB_USER"],
        "PASSWORD": os.environ["DB_PASSWORD"],
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
    }
}

# Custom user model
AUTH_USER_MODEL = "api.User"

# DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
}

# SimpleJWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]
CORS_ALLOW_CREDENTIALS = True

# Sandbox database (used by executor service)
SANDBOX_DATABASE_URL = os.environ.get("SANDBOX_DATABASE_URL", "")

# Multiple sandbox instances: "id|label|url, id|label|url, ..."
SANDBOX_INSTANCES = []
_raw_instances = os.environ.get("SANDBOX_INSTANCES", "")
if _raw_instances:
    for entry in _raw_instances.split(","):
        entry = entry.strip()
        if not entry:
            continue
        parts = entry.split("|", 2)
        if len(parts) == 3:
            SANDBOX_INSTANCES.append({
                "id": parts[0].strip(),
                "label": parts[1].strip(),
                "url": parts[2].strip(),
            })
# Fallback: if no instances configured, use the single SANDBOX_DATABASE_URL
if not SANDBOX_INSTANCES and SANDBOX_DATABASE_URL:
    SANDBOX_INSTANCES = [{"id": "default", "label": "Default", "url": SANDBOX_DATABASE_URL}]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True
