# Migración: MySQL demo backend -> PostgreSQL trazable

## Resumen

El backend fue actualizado desde FastAPI + SQLAlchemy + PyMySQL con tablas `nodes/edges` hacia FastAPI + SQLAlchemy sync + PostgreSQL con Alembic.

## Cambios principales

- PostgreSQL reemplaza MySQL/MariaDB.
- `psycopg[binary]` reemplaza `pymysql`.
- Alembic pasa a ser la fuente principal del esquema.
- El modelo canónico ahora usa `entities`, `entity_identifiers`, `relationships`, `sources`, `raw_records`, `ingestion_runs` y `risk_flags`.
- `metadata` flexible usa `JSONB`.
- Búsqueda usa `ILIKE` + `pg_trgm`/`similarity`.
- El frontend puede consultar la API real y conserva fallback a datos demo.
- IA queda como stub intencional.

## Comandos

```bash
docker compose -f docker-compose.dev.yml up -d postgres
cd backend
UV_CACHE_DIR=../.uv-cache uv python pin 3.12
UV_CACHE_DIR=../.uv-cache uv venv --clear venv --python 3.12
UV_CACHE_DIR=../.uv-cache uv pip install -r requirements.txt --python venv/bin/python
cp .env.example .env
venv/bin/alembic upgrade head
venv/bin/python -m scripts.seed_dev
venv/bin/python -m uvicorn app:app --reload --port 3001
```

## Ingesta

ChileCompra tiene conector inicial con:

- uso de `CHILECOMPRA_TICKET` para API real;
- modo fixture explícito para desarrollo;
- guardado de raw records y fuente;
- normalización de organismo comprador, licitación y proveedor.

InfoLobby, InfoProbidad, Registro de Colaboradores y SERVEL quedan estructurados y documentados como pendientes de endpoint/dataset oficial.
