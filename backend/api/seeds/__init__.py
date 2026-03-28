import importlib
import pkgutil


def run_all_seeds(stdout, style):
    """Auto-discover and run all seed modules in order.

    Seed files are named with a numeric prefix for ordering:
        001_users.py, 002_challenges.py, ...

    Each module must define a `run(stdout, style)` function.
    """
    package = importlib.import_module("api.seeds")
    seed_modules = sorted(
        name
        for _, name, _ in pkgutil.iter_modules(package.__path__)
        if not name.startswith("_")
    )

    for module_name in seed_modules:
        module = importlib.import_module(f"api.seeds.{module_name}")
        if hasattr(module, "run"):
            stdout.write(f"  Running {module_name}...")
            module.run(stdout, style)
        else:
            stdout.write(style.WARNING(f"  Skipping {module_name} (no run function)"))
