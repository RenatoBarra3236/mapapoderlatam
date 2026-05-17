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
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m scripts.seed_dev
python -m uvicorn app:app --reload --port 3001
```

## Ingesta ChileCompra

ChileCompra está implementado para los endpoints documentados en `third-party/docs`:

- `licitaciones.json?codigo=[Numero de la licitacion]&ticket=[Ticket de Acceso]`
- `OrdenCompra.json?codigo=[Codigo orden de Compra]&ticket=[Ticket de Acceso]`

Seed real:

```bash
CHILECOMPRA_TICKET=... CHILECOMPRA_SEED_TENDER_CODES=2424-12-LP24 python -m scripts.seed_chilecompra
CHILECOMPRA_TICKET=... CHILECOMPRA_SEED_OC_CODES=2424-77-SE24 python -m scripts.seed_chilecompra
```

Ingesta puntual:

```bash
python -m scripts.ingest chilecompra --kind licitaciones --codigo 2424-12-LP24
python -m scripts.ingest chilecompra --kind ordenes_compra --codigo 2424-77-SE24
```

Los conectores de InfoLobby, InfoProbidad, Registro de Colaboradores y SERVEL quedan preparados con errores explícitos hasta definir endpoints/datasets oficiales.

## IA

La utilidad de Claude queda sin exponer como feature de producto. La API y el frontend no llaman servicios de IA reales en esta fase.
