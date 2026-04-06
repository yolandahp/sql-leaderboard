from .auth import register, login, me, my_submissions, my_stats  # noqa: F401
from .challenges import challenge_list, challenge_detail, challenge_admin_detail, challenge_expected_output  # noqa: F401
from .stats import platform_stats  # noqa: F401
from .leaderboard import leaderboard, challenge_leaderboard  # noqa: F401
from .submissions import (  # noqa: F401
    submit_query,
    submission_detail,
    index_advice,
    submission_comparison_targets,
    submission_plan_diff,
)
