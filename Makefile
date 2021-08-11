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

drop:
	@$(CLICKHOUSE_SHELL) -n --query "drop database servicegraph"
.PHONY: drop

clickhouse-shell:
	@$(CLICKHOUSE_SHELL) -d servicegraph
.PHONY: clickhouse-shell

clickhouse-debug-shell:
	@$(CLICKHOUSE_SHELL) -d servicegraph --send_logs_level=debug
.PHONY: clickhouse-debug-shell

api-server: up
	cd rust/servicegraph-api && cargo run

gen-data: api-server
	python3 python/sample_data/gen_data.py

start-services:
	# starts the test server (at 0.0.0.0:8000)
	. .venv/bin/activate && cd python && python test-apps.py

start-locust:
	# starts locust (at 0.0.0.0:8089)
	. .venv/bin/activate && cd python && locust

setup: setup-venv
.PHONY: setup

setup-venv: .venv/bin/python
.PHONY: setup-venv

.venv/bin/python: Makefile
	@rm -rf .venv
	@which virtualenv || sudo pip install virtualenv
	virtualenv -p $$PYTHON_VERSION .venv
	pip install -r requirements.txt

