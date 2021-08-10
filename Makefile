COMPOSE_PROJECT_NAME=servicegraph
CLICKHOUSE_SHELL=docker run --rm -it --net=host yandex/clickhouse-client:21.6 -h host.docker.internal
export PYTHON_VERSION := python3


up:
	@docker compose -p "$(COMPOSE_PROJECT_NAME)" up -d
.PHONY: up

down:
	@docker compose -p "$(COMPOSE_PROJECT_NAME)" down
.PHONY: down

top:
	@docker ps -f 'name=$(COMPOSE_PROJECT_NAME)' --format "table {{.Names}}\t{{.Command}}\t{{.Status}}\t{{.State}}"
.PHONY: top

schema:
	@$(CLICKHOUSE_SHELL) -n --query "$$(cat schema.sql)"
.PHONY: schema

clickhouse-shell:
	@$(CLICKHOUSE_SHELL) -d servicegraph
.PHONY: clickhouse-shell

setup: setup-venv
.PHONY: setup

setup-venv: .venv/bin/python
.PHONY: setup-venv

.venv/bin/python: Makefile
	@rm -rf .venv
	@which virtualenv || sudo pip install virtualenv
	virtualenv -p $$PYTHON_VERSION .venv
	pip install -r requirements.txt
