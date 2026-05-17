# CLAUDE.md - Mapa de Poder LATAM

Contexto de trabajo para agentes.

## Producto

Plataforma de transparencia para explorar redes de poder politico, empresarial, contractual y de lobby en Chile/LATAM. El frontend muestra grafos, tablas, timeline, flags y chat simulado. El backend persiste datos reales o fixtures trazables.

## Stack actual

- Backend: FastAPI, SQLAlchemy sync, PostgreSQL, Alembic.
- DB driver: `psycopg`.
- Frontend: React + Vite con visualizacion SVG custom.
- Ingesta: conectores Python en `backend/ingestion`.
- IA: stub intencional. No implementar endpoints IA ni llamadas reales sin una fase dedicada.

## Backend

Tablas canonicas:

- `entities`
- `entity_identifiers`
- `relationships`
- `sources`
- `raw_records`
- `ingestion_runs`
- `risk_flags`

Migraciones:

```bash
cd backend
alembic upgrade head
```

Seed de desarrollo:

```bash
venv/bin/python -m scripts.seed_dev
```

Endpoints:

- `GET /api/health`
- `GET /api/search?q=...`
- `GET /api/entities/{entity_id}`
- `GET /api/graph/{entity_id}?depth=2`
- `GET /api/cases`
- `GET /api/cases/{case_id}`

## Frontend

El frontend usa `frontend/src/lib/api.js` para consultar backend cuando esta disponible. Si falla, mantiene fallback a `frontend/src/lib/demoData.js`.

No redisenar la interfaz salvo que se pida explicitamente.

## Variables

```env
DATABASE_URL=postgresql+psycopg://mapapoder:mapapoder@localhost:5432/mapapoderlatam
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CHILECOMPRA_TICKET=
ANTHROPIC_API_KEY=
```

`ANTHROPIC_API_KEY` no debe ser requerida para ejecutar el proyecto.
