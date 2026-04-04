import re

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)

    class Meta:
        db_table = "users"


class Challenge(models.Model):
    DIFFICULTY_CHOICES = [
        ("easy", "Easy"),
        ("medium", "Medium"),
        ("hard", "Hard"),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default="medium")
    schema_sql = models.TextField(help_text="DDL to set up the challenge schema")
    seed_sql = models.TextField(help_text="DML to populate data")
    index_sql = models.TextField(blank=True, default="", help_text="CREATE INDEX statements for the indexed instance")
    seed_sql_large = models.TextField(blank=True, default="", help_text="Extra seed SQL for the large dataset instance")
    ground_truth_query = models.TextField(help_text="Expected correct query")
    materialized_schema_sql = models.TextField(
        blank=True, default="",
        help_text="CREATE TABLE statements only (no functions)",
    )
    materialized_seed_sql = models.TextField(
        blank=True, default="",
        help_text="Deterministic INSERT statements generated from seed_sql",
    )
    expected_output = models.JSONField(
        null=True, blank=True,
        help_text="Snapshot of ground truth output (columns + rows)",
    )
    time_limit_ms = models.IntegerField(default=5000)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "challenges"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def schema_tables(self):
        return re.findall(
            r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)",
            self.schema_sql,
            re.IGNORECASE,
        )


class Submission(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="submissions")
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="submissions")
    query = models.TextField()
    is_correct = models.BooleanField(default=False)
    execution_time_ms = models.FloatField(null=True, blank=True)
    planning_time_ms = models.FloatField(null=True, blank=True)
    total_cost = models.FloatField(null=True, blank=True)
    explain_output = models.TextField(null=True, blank=True)
    plan_artifacts = models.JSONField(
        null=True,
        blank=True,
        help_text="Per-instance execution metadata and raw JSON plan artifacts.",
    )
    error_message = models.TextField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "submissions"
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"Submission #{self.id} by {self.user.username}"
