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

Discovery por fecha y hydration desde cola:

```bash
python -m scripts.discover_chilecompra --date 2026-05-17 --kind all
python -m scripts.hydrate_chilecompra --budget 500
```

Worker 24/7:

```bash
python -m scripts.chilecompra_worker --daily-budget 9000 --hydration-budget 500
```

El worker duerme fuera de la ventana nocturna `22:00-07:00`, cuenta requests por día/ticket y corta antes del límite oficial si llega al presupuesto configurado.

## Ingesta InfoLobby

InfoLobby se carga desde CSV locales en `backend/data/infolobby`. Los archivos oficiales exportados están codificados como UTF-16 y se procesan en streaming para evitar cargar millones de filas en memoria.

TUI general de seedeo:

```bash
python -m scripts.seed_data_tui
```

Atajos principales:

- `c`: activa el worker de ChileCompra en segundo plano.
- `i`: carga InfoLobby desde CSV locales.
- `r`: refresca contadores.
- `q`: sale.

Prueba acotada:

```bash
python -m scripts.ingest infolobby --file audiencias --limit 100 --batch-size 50
```

Carga completa:

```bash
python -m scripts.ingest infolobby --data-dir data/infolobby --batch-size 1000
```

Los conectores de InfoProbidad, Registro de Colaboradores y SERVEL quedan preparados con errores explícitos hasta definir endpoints/datasets oficiales.

## IA

La utilidad de Claude queda sin exponer como feature de producto. La API y el frontend no llaman servicios de IA reales en esta fase.
