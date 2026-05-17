# Mapa de Poder LATAM

Plataforma de transparencia para visualizar redes entre personas, empresas, organismos públicos, contratos, audiencias, transferencias y otras fuentes públicas.

El frontend React/Vite mantiene la demo visual existente y ahora puede consumir la API real. Si el backend no responde o no hay datos, conserva `demoData.js` como fallback.

## Stack

- Backend: FastAPI, SQLAlchemy sync, PostgreSQL, Alembic
- Frontend: React, Vite, CSS/Tailwind existente
- Ingesta: conectores Python en `backend/ingestion`
- IA: stub intencional; no se llaman APIs de IA reales

## Ejecución

```bash
# 1. PostgreSQL
docker compose -f docker-compose.dev.yml up -d postgres

# 2. Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m scripts.seed_dev
python -m uvicorn app:app --reload --port 3001

# 3. Frontend
cd ../frontend
npm install
npm run dev
```

URLs:

- API: `http://localhost:3001`
- Frontend: `http://localhost:5173`
- Swagger: `http://localhost:3001/docs`

## Endpoints

- `GET /api/health`
- `GET /api/search?q=municipalidad&limit=10`
- `GET /api/entities/{entity_id}`
- `GET /api/graph/{entity_id}?depth=2`
- `GET /api/cases`
- `GET /api/cases/{case_id}`

## Datos e ingesta

El seed de desarrollo carga fixtures marcados con:

- `metadata.is_demo = true`
- `metadata.source_mode = "fixture"`

ChileCompra está implementado como primer conector. Para API real configura:

```env
CHILECOMPRA_TICKET=
CHILECOMPRA_SEED_TENDER_CODES=2424-12-LP24
CHILECOMPRA_SEED_OC_CODES=2424-77-SE24
```

Y ejecuta:

```bash
cd backend
python -m scripts.seed_chilecompra
```

También puedes ingestar códigos puntuales:

```bash
python -m scripts.ingest chilecompra --kind licitaciones --codigo 2424-12-LP24
python -m scripts.ingest chilecompra --kind ordenes_compra --codigo 2424-77-SE24
```

Sin ticket, el conector falla con un mensaje explícito. Los fixtures se usan solo con `--fixture` para desarrollo local.

InfoLobby, InfoProbidad, Registro de Colaboradores y SERVEL están preparados como conectores con pendientes concretos de endpoint/dataset oficial.

## Configuración

Ver `backend/.env.example` y `frontend/.env.example`.

`DATABASE_URL` esperado:

```env
DATABASE_URL=postgresql+psycopg://mapapoder:mapapoder@localhost:5432/mapapoderlatam
```

`ANTHROPIC_API_KEY` puede existir, pero no es requerida ni usada por endpoints de producto en esta fase.
