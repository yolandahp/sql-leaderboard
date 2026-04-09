import logging
import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from api.models import Challenge, Submission
from api.services.executor import execute_on_all_instances, ExecutionError
from api.services.scorer import check_correctness

User = get_user_model()
logger = logging.getLogger(__name__)

MOCK_USERNAMES = [
    "sql_wizard", "query_king", "db_ninja", "index_master", "join_guru",
    "select_star", "tuple_queen", "hash_join", "btree_fan", "pg_lover",
    "norm_form", "acid_test", "vacuum_bot", "wal_writer", "seq_scan",
    "nest_loop", "agg_node", "cte_hero", "lateral_joe", "window_fn",
    "merge_sort", "bitmap_idx", "toast_man", "mvcc_nerd", "planner99",
]

# One query per challenge (ground truth or close to it)
CHALLENGE_QUERIES = {
    "Customer Order Summary": (
        "SELECT c.name AS customer_name, COUNT(o.id) AS order_count, "
        "COALESCE(SUM(o.amount), 0) AS total_spend "
        "FROM customers c LEFT JOIN orders o ON o.customer_id = c.id "
        "GROUP BY c.id, c.name ORDER BY total_spend DESC;"
    ),
    "Top Products by Region": (
        "SELECT * FROM ("
        "SELECT r.name AS region, p.name AS product, "
        "SUM(oi.quantity * oi.unit_price) AS revenue, "
        "RANK() OVER (PARTITION BY r.id ORDER BY SUM(oi.quantity * oi.unit_price) DESC) AS rnk "
        "FROM order_items oi "
        "JOIN products p ON p.id = oi.product_id "
        "JOIN regions r ON r.id = oi.region_id "
        "GROUP BY r.id, r.name, p.id, p.name"
        ") ranked WHERE rnk <= 3;"
    ),
    "Revenue Running Total": (
        "SELECT p.category, o.order_date, "
        "SUM(o.quantity * p.price) AS daily_revenue, "
        "SUM(SUM(o.quantity * p.price)) OVER "
        "(PARTITION BY p.category ORDER BY o.order_date) AS running_total "
        "FROM orders o JOIN products p ON p.id = o.product_id "
        "WHERE o.order_date >= CURRENT_DATE - INTERVAL '1 year' "
        "GROUP BY p.category, o.order_date "
        "ORDER BY p.category, o.order_date;"
    ),
    "High-Value Customer Orders": (
        "SELECT c.name AS customer_name, c.region, c.segment, "
        "COUNT(o.id) AS order_count, "
        "SUM(o.total_amount) AS total_revenue, "
        "AVG(o.total_amount) AS avg_order_value "
        "FROM customers c "
        "JOIN orders o ON o.customer_id = c.id "
        "WHERE o.status = 'completed' "
        "AND o.order_date >= '2024-06-01' "
        "AND c.region = 'North' "
        "GROUP BY c.id, c.name, c.region, c.segment "
        "HAVING COUNT(o.id) >= 3 "
        "ORDER BY total_revenue DESC LIMIT 20;"
    ),
    "Course Prerequisite Chains": (
        "WITH RECURSIVE chain AS ("
        "  SELECT c.id AS course_id, c.department_id, c.code, c.title, 1 AS depth "
        "  FROM courses c "
        "  WHERE NOT EXISTS (SELECT 1 FROM prerequisites p WHERE p.course_id = c.id) "
        "  UNION ALL "
        "  SELECT c.id, c.department_id, c.code, c.title, ch.depth + 1 "
        "  FROM chain ch "
        "  JOIN prerequisites p ON p.prerequisite_id = ch.course_id "
        "  JOIN courses c ON c.id = p.course_id"
        ") "
        "SELECT d.name AS department, ch.code AS course_code, ch.title AS course_title, ch.depth AS chain_length "
        "FROM ("
        "  SELECT DISTINCT ON (department_id) department_id, code, title, depth "
        "  FROM chain "
        "  ORDER BY department_id, depth DESC"
        ") ch "
        "JOIN departments d ON d.id = ch.department_id "
        "WHERE ch.depth >= 3 "
        "ORDER BY ch.depth DESC, d.name;"
    ),
    "Hospital Bed Occupancy": (
        "SELECT w.name AS ward_name, d.day::date AS date, "
        "COUNT(a.id) AS occupied_beds, w.total_beds, "
        "ROUND(COUNT(a.id) * 100.0 / w.total_beds, 2) AS occupancy_pct "
        "FROM wards w "
        "CROSS JOIN generate_series("
        "  '2026-04-01'::date - INTERVAL '6 months', "
        "  '2026-04-01'::date, "
        "  '1 day'::interval"
        ") AS d(day) "
        "LEFT JOIN admissions a "
        "  ON a.ward_id = w.id "
        "  AND a.admit_date <= d.day "
        "  AND (a.discharge_date >= d.day OR a.discharge_date IS NULL) "
        "GROUP BY w.id, w.name, w.total_beds, d.day "
        "ORDER BY w.name, d.day;"
    ),
    "Flight Route Analytics": (
        "SELECT o.code AS origin_code, d.code AS destination_code, "
        "COUNT(*) AS total_flights, "
        "ROUND(AVG(EXTRACT(EPOCH FROM (f.actual_departure - f.scheduled_departure)) / 60.0), 2) AS avg_delay_minutes, "
        "ROUND("
        "  SUM(CASE WHEN f.actual_departure <= f.scheduled_departure + INTERVAL '15 minutes' THEN 1 ELSE 0 END) * 100.0 "
        "  / COUNT(*), 2"
        ") AS on_time_pct "
        "FROM flights f "
        "JOIN airports o ON o.id = f.origin_id "
        "JOIN airports d ON d.id = f.destination_id "
        "WHERE f.status != 'cancelled' AND f.actual_departure IS NOT NULL "
        "GROUP BY GROUPING SETS ((o.code, d.code), (o.code), (d.code), ()) "
        "HAVING COUNT(*) >= 10 "
        "ORDER BY COUNT(*) DESC;"
    ),
    "Social Network Influence": (
        "SELECT u.display_name, "
        "COUNT(DISTINCT p.id) AS post_count, "
        "SUM(CASE WHEN fr.friend_id IS NULL THEN 1 ELSE 0 END) AS non_friend_engagements, "
        "ROUND("
        "  SUM(CASE WHEN fr.friend_id IS NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2"
        ") AS non_friend_ratio "
        "FROM users u "
        "JOIN posts p ON p.user_id = u.id "
        "JOIN engagements e ON e.post_id = p.id "
        "LEFT JOIN friendships fr ON fr.user_id = u.id AND fr.friend_id = e.user_id "
        "GROUP BY u.id, u.display_name "
        "HAVING COUNT(DISTINCT p.id) >= 5 AND COUNT(*) >= 20 "
        "ORDER BY non_friend_engagements DESC LIMIT 20;"
    ),
}


def _create_mock_user(username):
    if User.objects.filter(username=username).exists():
        return User.objects.get(username=username)
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="mock123",
    )


def _run_baseline(challenge, query, stdout, style):
    """Execute one real query to get baseline timing. Returns (exec_ms, plan_ms) or None."""
    try:
        user_result, instance_results = execute_on_all_instances(query, challenge)
        avg_exec = sum(ir.execution_time_ms for ir in instance_results) / len(instance_results)
        avg_plan = sum(ir.planning_time_ms for ir in instance_results) / len(instance_results)

        snapshot = challenge.expected_output or {}
        is_correct = check_correctness(
            user_result,
            snapshot.get("columns", []),
            snapshot.get("rows", []),
        )

        if not is_correct:
            stdout.write(style.WARNING(f"    Baseline for '{challenge.title}': INCORRECT, skipping"))
            return None

        stdout.write(f"    Baseline for '{challenge.title}': exec={avg_exec:.2f}ms plan={avg_plan:.2f}ms")
        return avg_exec, avg_plan
    except (ExecutionError, Exception) as e:
        stdout.write(style.WARNING(f"    Baseline for '{challenge.title}': failed ({e})"))
        return None


def run(stdout, style):
    if Submission.objects.filter(user__username__in=MOCK_USERNAMES).exists():
        stdout.write("  Mock submissions already exist, skipping.")
        return

    challenges = list(Challenge.objects.filter(is_active=True).order_by("id"))
    if not challenges:
        stdout.write(style.WARNING("  No challenges found, skipping mock submissions."))
        return

    random.seed(42)

    # Step 1: run one real execution per challenge to get baseline timings
    stdout.write("  Running baseline queries...")
    baselines = {}
    for challenge in challenges:
        query = CHALLENGE_QUERIES.get(challenge.title)
        if not query:
            continue
        result = _run_baseline(challenge, query, stdout, style)
        if result:
            baselines[challenge.id] = result

    if not baselines:
        stdout.write(style.WARNING("  No baselines obtained, aborting."))
        return

    # Step 2: create mock users
    users = [_create_mock_user(name) for name in MOCK_USERNAMES]

    # Step 3: generate submissions with inflated times (1.2x–1.5x baseline)
    now = timezone.now()
    submissions = []

    for user in users:
        num_challenges = random.randint(2, len(challenges))
        selected = random.sample(challenges, num_challenges)

        for challenge in selected:
            if challenge.id not in baselines:
                continue

            base_exec, base_plan = baselines[challenge.id]
            query = CHALLENGE_QUERIES.get(challenge.title, "SELECT 1;")

            # Each mock user gets 1.2x to 1.5x the baseline time
            multiplier = random.uniform(1.2, 1.5)
            exec_ms = round(base_exec * multiplier, 3)
            plan_ms = round(base_plan * multiplier, 3)

            submitted_at = now - timedelta(
                days=random.randint(0, 14),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )

            submissions.append(Submission(
                user=user,
                challenge=challenge,
                query=query,
                is_correct=True,
                execution_time_ms=exec_ms,
                planning_time_ms=plan_ms,
                total_cost=random.uniform(10, 500),
                submitted_at=submitted_at,
            ))

    Submission.objects.bulk_create(submissions)
    stdout.write(style.SUCCESS(
        f"  Created {len(submissions)} mock submissions for {len(users)} users "
        f"(baselines from {len(baselines)} challenges)"
    ))
