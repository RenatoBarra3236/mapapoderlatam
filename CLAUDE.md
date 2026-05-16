# CLAUDE.md — Mapa de Poder Político LATAM

Archivo de contexto para Claude Code. Lee esto antes de tocar cualquier archivo del proyecto.

---

## ¿Qué es este proyecto?

Plataforma de transparencia anticorrupción desarrollada para una hackathon latinoamericana con el tema **"Transparency & Corruption"**.

Permite buscar un RUT o nombre y visualizar la red de conexiones entre **funcionarios, empresas y contratos públicos** en LATAM. La propuesta de valor frente a plataformas existentes como DeQuiénes.cl es que no solo muestra los datos: **la IA los interpreta**, detecta red flags y genera un resumen en lenguaje natural.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Python 3.8+ + FastAPI |
| Base de datos | MySQL 5.7+ (con SQLAlchemy ORM) |
| Frontend | React + Vite + Tailwind CSS |
| Visualización de grafo | Vis.js Network |
| IA | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Ingesta de datos | Scripts Python en `data/scripts/` |

---

## Estructura de carpetas

```
mapapoderlatam/
├── CLAUDE.md                        ← ESTÁS AQUÍ
├── MIGRATION_SUMMARY.md             ← Resumen migración Node.js → Python
├── README.md
├── .gitignore
│
├── backend/
│   ├── app.py                       ← FastAPI app, punto de entrada
│   ├── requirements.txt              ← dependencias Python (pip)
│   ├── .env.example                 ← copiar a .env y rellenar
│   ├── SETUP.md                     ← guía instalación backend
│   ├── init_db.py                   ← script inicializar BD MySQL
│   ├── config/
│   │   ├── database.py              ← conexión MySQL + SessionLocal (SQLAlchemy)
│   │   ├── settings.py              ← configuración (Pydantic)
│   │   └── schema.sql               ← DDL: tablas nodes, edges y vista node_degree
│   ├── models/
│   │   ├── node.py                  ← modelo SQLAlchemy Node
│   │   └── edge.py                  ← modelo SQLAlchemy Edge
│   ├── schemas/
│   │   ├── node.py                  ← Pydantic schemas Node (validación)
│   │   └── edge.py                  ← Pydantic schemas Edge
│   ├── routes/
│   │   ├── graph.py                 ← GET /api/graph/:id?depth=2, /stats
│   │   └── search.py                ← GET /api/search?q=nombre
│   ├── controllers/
│   │   ├── graph_controller.py      ← CTE recursivo MySQL para subgrafo + stats
│   │   └── search_controller.py     ← búsqueda LIKE en MySQL
│   └── utils/
│       ├── claude_client.py         ← integración Claude API
│       └── seed.py                  ← carga datos de demo realistas
│
├── backend_old/                     ← respaldo: código Node.js + Express original
│
├── frontend/
│   ├── .env.example                 ← copiar a .env y rellenar
│   ├── index.html
│   ├── vite.config.js               ← proxy /api → localhost:3001
│   └── src/
│       ├── main.jsx                 ← entry point React
│       ├── App.jsx                  ← layout principal: header + grafo + panel
│       ├── index.css                ← Tailwind base
│       ├── components/
│       │   ├── graph/
│       │   │   └── GraphCanvas.jsx  ← visualización Vis.js Network
│       │   └── ui/
│       │       ├── SearchBar.jsx    ← autocomplete con debounce 300ms
│       │       └── NodeDetail.jsx   ← panel lateral: stats + acciones
│       ├── hooks/
│       │   ├── useGraph.js          ← carga subgrafo desde API
│       │   └── useSearch.js         ← búsqueda con debounce
│       ├── services/
│       │   └── api.js               ← axios con baseURL desde VITE_API_URL
│       ├── pages/                   ← (vacío, para rutas futuras)
│       └── utils/                   ← (vacío, para helpers futuros)
│
└── data/
    ├── raw/                         ← CSVs/JSONs descargados sin procesar
    ├── processed/                   ← datos limpios listos para importar
    └── scripts/
        └── ingest_chilecompra.js    ← ingesta desde API de Mercado Público (Python en futuro)
```

---

## Modelo de datos

### Tabla `nodes`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT AUTO_INCREMENT | PK autoincremental |
| `external_id` | VARCHAR(255) UNIQUE | RUT, ID licitación, etc. |
| `type` | VARCHAR(50) | `'person'` / `'company'` / `'contract'` |
| `name` | VARCHAR(255) | Nombre completo |
| `country` | VARCHAR(10) | Código ISO (`'CL'`, `'CO'`, `'PE'`, `'MX'`) |
| `metadata` | JSON | campos extra: cargo, monto, sector, etc. |
| `risk_score` | INTEGER | calculado: `total_degree * 10` |
| `created_at` | DATETIME | timestamp de creación |

### Tabla `edges`

| Campo | Tipo | Descripción |
|---|---|---|
| `source_id` | INTEGER | FK → nodes.id |
| `target_id` | INTEGER | FK → nodes.id |
| `type` | VARCHAR(50) | `owns` / `awarded` / `signed` / `family_of` / `former_role` / `donated_to` |
| `label` | VARCHAR(255) | descripción legible de la relación |
| `weight` | DECIMAL(10,2) | fuerza (ej: monto en millones CLP) |
| `source_url` | VARCHAR(500) | URL al documento original |
| `valid_from` / `valid_to` | DATE | período de validez de la relación |
| `metadata` | JSON | información adicional |
| `created_at` | DATETIME | timestamp de creación |

### Vista `node_degree`

Calcula `out_degree`, `in_degree` y `total_degree` por nodo. Usada para el `risk_score`.

---

## API endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | health check |
| `GET` | `/api/search?q=nombre&type=person&country=CL&limit=10` | búsqueda fulltext |
| `GET` | `/api/graph/:nodeId?depth=2` | subgrafo hasta N grados (máx 3) |
| `GET` | `/api/graph/:nodeId/stats` | estadísticas del nodo |

### Ejemplo respuesta `/api/graph/1?depth=2`

```json
{
  "nodes": [
    { "id": 1, "type": "person", "name": "Carlos Fuentes", "is_root": true, "risk_score": 40 },
    { "id": 5, "type": "company", "name": "Constructora Los Andes SpA", "is_root": false }
  ],
  "edges": [
    { "source_id": 1, "target_id": 5, "type": "owns", "label": "Socio fundador (40%)", "weight": 0.4 }
  ]
}
```

---

## Variables de entorno

### `backend/.env`

```env
PORT=3001
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/mapapoderlatam
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-...          # API key Claude
```

**Nota:** `DATABASE_URL` ahora usa MySQL. Formato: `mysql+pymysql://usuario:password@host:puerto/db`

### `frontend/.env`

```env
VITE_API_URL=http://localhost:3001/api
```

---

## Comandos útiles

```bash
# Backend - Setup inicial
cd backend
python -m venv venv
source venv/bin/activate              # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales MySQL

# Inicializar base de datos MySQL
python init_db.py                      # Crea tablas + carga datos de demo

# Iniciar servidor FastAPI
python -m uvicorn app:app --reload --port 3001
# Estará en http://localhost:3001
# Docs interactivos: http://localhost:3001/docs

# Frontend
cd ../frontend
npm install
npm run dev                             # app en http://localhost:5173

# Ingesta de datos reales (futuro: migrar a Python)
# node data/scripts/ingest_chilecompra.js
```

**Ver también:** `backend/SETUP.md` para guía detallada de instalación

---

## Módulos pendientes de implementar

Estos son los diferenciadores frente a DeQuiénes.cl. Son la propuesta de valor del hackathon:

### 1. Resumen ejecutivo con IA (PRIORIDAD ALTA)
- **Archivo a crear:** `backend/controllers/ai_controller.py`
- **Endpoint a crear:** `GET /api/ai/summary/{nodeId}`
- Llama a la API de Claude con el perfil completo del nodo
- Devuelve: resumen en lenguaje natural + lista de red flags detectados
- Modelo: `claude-3-5-sonnet-20241022`

### 2. Detector de red flags (PRIORIDAD ALTA)
- **Archivo a crear:** `backend/controllers/flags_controller.py`
- Lógica de negocio que detecta patrones sospechosos en los datos:
  - empresa creada días antes de ganar una licitación
  - funcionario que firma contrato con empresa donde es socio su familiar
  - múltiples audiencias de lobby con la misma empresa en corto plazo
  - crecimiento patrimonial inconsistente con sueldo declarado
  - paso de cargo público a directorio de empresa regulada (puerta giratoria)

### 3. Chatbot del perfil (PRIORIDAD MEDIA)
- **Archivo a crear:** `frontend/src/components/ui/ProfileChat.jsx`
- El usuario hace preguntas en lenguaje natural sobre el perfil abierto
- La IA responde usando los datos del subgrafo como contexto (RAG simple)

### 4. Cruce con ICIJ Offshore Leaks (PRIORIDAD MEDIA)
- **Script a crear:** `data/scripts/ingest_icij.py`
- Descarga el CSV del ICIJ y lo importa como nodos tipo `'offshore'`
- Al buscar un nombre, cruza automáticamente con esta base

### 5. Expansión multipaís LATAM (PRIORIDAD BAJA para hackathon)
- Scripts Python de ingesta para Colombia (SECOP), Perú (SEACE), México (CompraNet)
- Usar el estándar OCDS para normalizar entre países

### 6. Informe PDF exportable (PRIORIDAD BAJA para hackathon)
- Genera PDF con: perfil, grafo, línea de tiempo, red flags y fuentes
- Para periodistas, fiscales y ONGs

---

## Fuentes de datos

| Fuente | País | Tipo | URL |
|---|---|---|---|
| ChileCompra API | Chile | Contratos públicos | `api.mercadopublico.cl` |
| OCDS Registry | LATAM | Contratos (estándar) | `data.open-contracting.org` |
| OpenSanctions | Global | PEPs + sanciones | `api.opensanctions.org` |
| ICIJ Offshore Leaks | Global | Panama/Pandora Papers | `offshoreleaks.icij.org` |
| OpenCorporates | Global | Registro de empresas | `api.opencorporates.com` |
| InfoTransparencia CPLT | Chile | Lobby + declaraciones | `infotransparencia.cl` |

---

## Colores del grafo (Vis.js)

| Tipo de nodo | Color fondo | Forma |
|---|---|---|
| `person` | `#534AB7` (morado) | elipse |
| `company` | `#0F6E56` (teal) | caja |
| `contract` | `#993C1D` (coral) | diamante |
| `offshore` | `#A32D2D` (rojo) | estrella (pendiente) |

---

## Contexto del hackathon

- **Tema:** Transparency & Corruption (nivel latinoamericano)
- **Equipo:** 4 personas, roles no definidos al inicio
- **Competidor identificado:** DeQuiénes.cl — agrega datos pero no los interpreta
- **Propuesta de valor:** "DeQuiénes te muestra los datos. Nosotros te dice qué significan."
- **Momento wow del pitch:** buscar un nombre real y que la IA diga en 5 segundos si hay conflictos de interés
