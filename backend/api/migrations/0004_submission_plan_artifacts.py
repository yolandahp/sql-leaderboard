from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0003_materialize_challenge_data"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="plan_artifacts",
            field=models.JSONField(
                blank=True,
                help_text="Per-instance execution metadata and raw JSON plan artifacts.",
                null=True,
            ),
        ),
    ]
