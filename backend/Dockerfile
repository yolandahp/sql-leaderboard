FROM python:3.12-slim

WORKDIR /app

# System dependencies for pglast / libpq
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Generate migrations, apply them, seed data, then start dev server
CMD ["sh", "-c", "python manage.py makemigrations --noinput && python manage.py migrate --noinput && python manage.py seed && python manage.py runserver 0.0.0.0:8000"]
