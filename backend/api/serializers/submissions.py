from rest_framework import serializers

from api.models import Submission


class SubmissionCreateSerializer(serializers.Serializer):
    challenge_id = serializers.IntegerField()
    query = serializers.CharField()


class SubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = [
            "id", "user_id", "challenge_id", "query", "is_correct",
            "execution_time_ms", "planning_time_ms", "total_cost",
            "explain_output", "error_message", "submitted_at",
        ]
