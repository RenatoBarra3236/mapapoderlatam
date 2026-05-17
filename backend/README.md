# Backend

API FastAPI para grafo de entidades públicas, empresas, contratos, audiencias y relaciones trazables.

## Base de datos

PostgreSQL es la base principal. El esquema se gestiona con Alembic y crea:

- `entities`
- `entity_identifiers`
- `relationships`
- `sources`
- `raw_records`
- `ingestion_runs`
- `risk_flags`

Usa `JSONB` para metadata flexible y `pg_trgm` para búsqueda por similitud.

## Desarrollo

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

## Ingesta

ChileCompra está implementado como conector inicial. Requiere `CHILECOMPRA_TICKET` para API real.

Los conectores de InfoLobby, InfoProbidad, Registro de Colaboradores y SERVEL quedan preparados con errores explícitos hasta definir endpoints/datasets oficiales.

## IA

La utilidad de Claude queda sin exponer como feature de producto. La API y el frontend no llaman servicios de IA reales en esta fase.
