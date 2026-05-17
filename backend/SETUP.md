# Setup Backend

Backend FastAPI sync + SQLAlchemy + PostgreSQL.

```bash
docker compose -f ../docker-compose.dev.yml up -d postgres
UV_CACHE_DIR=../.uv-cache uv python pin 3.12
UV_CACHE_DIR=../.uv-cache uv venv --clear venv --python 3.12
UV_CACHE_DIR=../.uv-cache uv pip install -r requirements.txt --python venv/bin/python
cp .env.example .env
venv/bin/alembic upgrade head
venv/bin/python -m scripts.seed_dev
venv/bin/python -m uvicorn app:app --reload --port 3001
```

Endpoints principales:

- `GET /api/health`
- `GET /api/search?q=municipalidad`
- `GET /api/entities/{entity_id}`
- `GET /api/graph/{entity_id}?depth=2`
- `GET /api/cases`
- `GET /api/cases/{case_id}`

Ingesta ChileCompra:

```bash
CHILECOMPRA_TICKET=... venv/bin/python -m scripts.ingest chilecompra
```

Sin ticket, solo usa fixtures explícitos de desarrollo. IA queda como stub; `ANTHROPIC_API_KEY` no es requerida.
