from rest_framework import serializers

from api.models import Challenge


class ChallengeListSerializer(serializers.ModelSerializer):
    submission_count = serializers.IntegerField(read_only=True, default=0)
    best_time_ms = serializers.FloatField(read_only=True, default=None)
    schema_tables = serializers.ListField(read_only=True)

    class Meta:
        model = Challenge
        fields = [
            "id", "title", "description", "difficulty",
            "time_limit_ms", "is_active", "created_at",
            "submission_count", "best_time_ms", "schema_tables",
        ]


class ChallengeDetailSerializer(ChallengeListSerializer):
    class Meta(ChallengeListSerializer.Meta):
        fields = ChallengeListSerializer.Meta.fields + ["schema_sql", "seed_sql"]


class ChallengeAdminSerializer(ChallengeDetailSerializer):
    class Meta(ChallengeDetailSerializer.Meta):
        fields = ChallengeDetailSerializer.Meta.fields + ["ground_truth_query"]


class ChallengeCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Challenge
        fields = [
            "title", "description", "difficulty", "schema_sql",
            "seed_sql", "ground_truth_query", "time_limit_ms", "is_active",
        ]
