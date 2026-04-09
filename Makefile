.PHONY: help up down restart logs migrate makemigrations seed prod prod-down prod-restart

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# --- Development ---

up: ## Start all services (background)
	docker compose up --build -d

down: ## Stop all services and delete volumes
	docker compose down -v

restart: ## Restart all services (clean)
	docker compose down -v
	docker compose up --build -d

logs: ## Tail backend logs
	docker compose logs -f backend

migrate: ## Run Django migrations
	docker compose exec backend python manage.py migrate

makemigrations: ## Create new migration after model changes
	docker compose exec backend python manage.py makemigrations

seed: ## Run database seeders
	docker compose exec backend python manage.py seed

# --- Production ---

prod: ## Start production services (background)
	docker compose -f docker-compose.prod.yml up --build -d

prod-down: ## Stop production services and delete volumes
	docker compose -f docker-compose.prod.yml down -v

prod-restart: ## Restart production services (clean)
	docker compose -f docker-compose.prod.yml down -v
	docker compose -f docker-compose.prod.yml up --build -d
