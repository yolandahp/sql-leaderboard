from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Challenge, Submission

User = get_user_model()


def make_plan(node_type="Seq Scan", relation_name="orders", total_time=15.0, rows=120, reads=40):
    return [
        {
            "Plan": {
                "Node Type": node_type,
                "Relation Name": relation_name,
                "Actual Total Time": total_time,
                "Actual Rows": rows,
                "Actual Loops": 1,
                "Shared Hit Blocks": 100,
                "Shared Read Blocks": reads,
                "Plans": [],
            },
            "Planning Time": 1.1,
            "Execution Time": total_time,
        }
    ]


def make_artifacts(instance_id="default", label="Default", plan=None):
    return {
        "primary_instance_id": instance_id,
        "instances": [
            {
                "instance_id": instance_id,
                "label": label,
                "execution_time_ms": 15.0,
                "planning_time_ms": 1.1,
                "total_cost": 10.0,
                "rows_returned": 10,
                "buffer_hits": 100,
                "buffer_reads": 40,
                "explain_json": plan,
            }
        ],
        "primary_plan": plan,
    }


class PlanDiffApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="plan-user",
            email="plan@example.com",
            password="secret123",
        )
        self.client.force_authenticate(self.user)
        self.challenge = Challenge.objects.create(
            title="Join tuning",
            description="Tune a join-heavy query",
            difficulty="medium",
            schema_sql="CREATE TABLE orders (id INT);",
            seed_sql="INSERT INTO orders (id) VALUES (1);",
            ground_truth_query="SELECT id FROM orders;",
            time_limit_ms=5000,
            is_active=True,
        )

    def create_submission(self, **overrides):
        defaults = {
            "user": self.user,
            "challenge": self.challenge,
            "query": "SELECT * FROM orders;",
            "is_correct": True,
            "execution_time_ms": 15.0,
            "planning_time_ms": 1.1,
            "total_cost": 10.0,
            "explain_output": "[]",
            "plan_artifacts": make_artifacts(plan=make_plan()),
        }
        defaults.update(overrides)
        return Submission.objects.create(**defaults)

    def test_comparison_targets_empty_when_current_submission_has_no_history(self):
        current = self.create_submission()

        response = self.client.get(f"/api/submissions/{current.id}/comparison-targets")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["targets"], [])
        self.assertIsNone(response.data["default_target_id"])

    def test_comparison_targets_prefers_fastest_correct_submission(self):
        fastest = self.create_submission(
            execution_time_ms=8.0,
            is_correct=True,
            plan_artifacts=make_artifacts(plan=make_plan(node_type="Index Scan", total_time=8.0, reads=4)),
        )
        self.create_submission(execution_time_ms=50.0, is_correct=False)
        current = self.create_submission(execution_time_ms=35.0)

        response = self.client.get(f"/api/submissions/{current.id}/comparison-targets")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["default_target_id"], fastest.id)
        fastest_target = next(target for target in response.data["targets"] if target["id"] == fastest.id)
        self.assertEqual(fastest_target["kind"], "fastest_correct")

    def test_missing_plan_target_returns_missing_plan_state(self):
        target = self.create_submission(
            is_correct=False,
            plan_artifacts=make_artifacts(plan=None),
        )
        current = self.create_submission()

        response = self.client.post(
            f"/api/submissions/{current.id}/plan-diff",
            {"target_submission_id": target.id, "instance_id": "default"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "missing_plan")

    def test_plan_diff_ready_state_includes_summary_and_matches_for_incorrect_current_submission(self):
        target = self.create_submission(
            is_correct=True,
            execution_time_ms=9.0,
            plan_artifacts=make_artifacts(plan=make_plan(node_type="Index Scan", total_time=9.0, reads=5)),
        )
        current = self.create_submission(
            is_correct=False,
            execution_time_ms=24.0,
            plan_artifacts=make_artifacts(plan=make_plan(node_type="Seq Scan", total_time=24.0, reads=60)),
        )

        response = self.client.post(
            f"/api/submissions/{current.id}/plan-diff",
            {"target_submission_id": target.id, "instance_id": "default"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ready")
        self.assertTrue(response.data["current_submission_incorrect"])
        self.assertTrue(response.data["summary"]["verdict"])
        self.assertTrue(response.data["matches"])
