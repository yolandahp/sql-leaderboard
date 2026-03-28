from django.core.management.base import BaseCommand

from api.seeds import run_all_seeds


class Command(BaseCommand):
    help = "Run all database seeders"

    def handle(self, *args, **options):
        self.stdout.write("Running seeders...")
        run_all_seeds(self.stdout, self.style)
        self.stdout.write(self.style.SUCCESS("Done."))
