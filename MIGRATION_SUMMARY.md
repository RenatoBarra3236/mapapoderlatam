# Migración: Node.js/PostgreSQL → Python FastAPI/MySQL ✅

## Resumen de cambios

### Backend
- ❌ **Removido**: `backend_old/` - Node.js + Express + PostgreSQL
- ✅ **Nuevo**: `backend/` - Python + FastAPI + MySQL

### Base de datos
- ❌ PostgreSQL → ✅ MySQL
- Mismos datos, mismas relaciones
- Indices y vistas adaptadas a MySQL

### API
- ✅ **RUTAS IDÉNTICAS** - Frontend sin cambios requeridos
  - `GET /api/graph/{nodeId}`
  - `GET /api/graph/{nodeId}/stats`
  - `GET /api/search?q=...`
  - `GET /api/health`

### Frontend
- ✅ **SIN CAMBIOS** - Sigue usando React
- URL de API en `frontend/.env.example`:
  ```
  VITE_API_URL=http://localhost:3001/api
  ```

## Archivos principales

### Backend (nuevo)
```
backend/
├── app.py                      # Aplicación FastAPI
├── requirements.txt            # pip dependencies
├── .env.example               # Configuración
├── SETUP.md                   # Guía instalación
├── init_db.py                 # Script inicializar BD
├── config/
│   ├── database.py            # Conexión MySQL + SQLAlchemy
│   ├── settings.py            # Variables de configuración
│   └── schema.sql             # Schema MySQL
├── models/
│   ├── node.py                # Modelo SQLAlchemy: Node
│   └── edge.py                # Modelo SQLAlchemy: Edge
├── routes/
│   ├── graph.py               # Endpoints: /api/graph/*
│   └── search.py              # Endpoints: /api/search
├── controllers/
│   ├── graph_controller.py    # Lógica: grafos con CTE recursivo
│   └── search_controller.py   # Lógica: búsqueda LIKE
└── utils/
    ├── claude_client.py       # Integración Claude API
    └── seed.py                # Datos de ejemplo
```

## Stack Tecnológico

### Backend
| Componente | Antes | Ahora |
|-----------|-------|-------|
| Framework | Express.js | FastAPI |
| Lenguaje | JavaScript/Node.js | Python 3.8+ |
| BD | PostgreSQL | MySQL |
| ORM | driver `pg` puro | SQLAlchemy |
| API Client | @anthropic-ai/sdk | anthropic (Python) |

### Frontend (sin cambios)
| Componente | Versión |
|-----------|---------|
| Framework | React 18.3.1 |
| Build Tool | Vite 5.4.2 |
| HTTP Client | Axios 1.7.2 |
| Grafo | vis-network 9.1.9 |

## Instalación rápida

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con credenciales MySQL
python init_db.py
python -m uvicorn app:app --reload --port 3001
```

### Frontend (igual que antes)
```bash
cd frontend
npm install
npm run dev
```

## Base de datos

### Antes (PostgreSQL)
```sql
-- Tipos nativos
type status = 'person' | 'company' | 'contract'
metadata JSONB
CREATE TABLE ... (...) 
```

### Ahora (MySQL)
```sql
-- Adaptado a MySQL
CHECK (type IN ('person', 'company', 'contract'))
metadata JSON
FULLTEXT INDEX para búsqueda
```

### Datos
- ✅ 4 personas (Carlos, Ana, Roberto, Marcela)
- ✅ 3 empresas (Constructora, Servicios, Consultora)
- ✅ 3 contratos (Ruta 5, OIRS, Plan Regulador)
- ✅ 10 relaciones (owns, awarded, signed, family_of, etc.)

## Características preservadas

✅ Búsqueda full-text  
✅ Grafo con CTE recursivo (expandir hasta 3 grados)  
✅ Estadísticas de nodo (grados, montos, riesgo)  
✅ Integración Claude API  
✅ CORS para frontend  
✅ Manejo de errores  
✅ Datos de ejemplo  

## Variables de entorno

```bash
# Backend: backend/.env
PORT=3001
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/mapapoderlatam
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-xxx

# Frontend: frontend/.env
VITE_API_URL=http://localhost:3001/api
```

## Testing

Endpoints de prueba:
```bash
# Health
curl http://localhost:3001/api/health

# Grafo del nodo 1
curl "http://localhost:3001/api/graph/1?depth=2"

# Stats del nodo 1
curl http://localhost:3001/api/graph/1/stats

# Búsqueda
curl "http://localhost:3001/api/search?q=carlos"
```

## Documentación de desarrollo

- **Backend**: Ver `backend/SETUP.md`
- **Frontend**: Ver `frontend/` (sin cambios)
- **API Docs**: http://localhost:3001/docs (Swagger)

## Notas importantes

1. El `backend_old/` contiene el código Node.js original como respaldo
2. MySQL debe estar corriendo en `localhost:3306`
3. El frontend **NO requiere cambios** - las rutas son idénticas
4. Usa `python init_db.py` para reset de datos
5. Los logs en desarrollo muestran SQL ejecutadas

## ¿Qué sigue?

- [ ] Instalar MySQL (si no está)
- [ ] Setup del backend (ver `SETUP.md`)
- [ ] Inicializar BD (`python init_db.py`)
- [ ] Probar endpoints
- [ ] Integrar con frontend existente
