# Setup Backend

Backend FastAPI sync + SQLAlchemy + PostgreSQL.

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

Endpoints principales:

- `GET /api/health`
- `GET /api/search?q=municipalidad`
- `GET /api/entities/{entity_id}`
- `GET /api/graph/{entity_id}?depth=2`
- `GET /api/cases`
- `GET /api/cases/{case_id}`

Ingesta ChileCompra:

```bash
CHILECOMPRA_TICKET=... CHILECOMPRA_SEED_TENDER_CODES=2424-12-LP24 python -m scripts.seed_chilecompra
CHILECOMPRA_TICKET=... python -m scripts.ingest chilecompra --kind ordenes_compra --codigo 2424-77-SE24
```

Sin ticket, solo usa fixtures explícitos de desarrollo con `--fixture`. IA queda como stub; `ANTHROPIC_API_KEY` no es requerida.
