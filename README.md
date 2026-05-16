# Mapa de Poder Político — LATAM

Plataforma de transparencia que visualiza la red de conexiones entre **funcionarios, empresas y contratos públicos** en Latinoamérica.

---

## Estructura del proyecto

```
mapapoderlatam/
├── backend/
│   ├── config/
│   │   ├── db.js               ← Conexión a PostgreSQL
│   │   └── schema.sql          ← Tablas nodes, edges y vista node_degree
│   └── src/
│       ├── index.js            ← Servidor Express
│       ├── routes/
│       │   ├── search.js       ← GET /api/search?q=nombre
│       │   └── graph.js        ← GET /api/graph/:id?depth=2
│       ├── controllers/
│       │   ├── searchController.js
│       │   └── graphController.js
│       └── utils/
│           └── seed.js         ← Datos de ejemplo para demo
│
├── frontend/
│   └── src/
│       ├── App.jsx             ← Layout principal
│       ├── components/
│       │   ├── graph/
│       │   │   └── GraphCanvas.jsx   ← Visualización Vis.js
│       │   └── ui/
│       │       ├── SearchBar.jsx     ← Búsqueda con autocomplete
│       │       └── NodeDetail.jsx    ← Panel lateral de detalle
│       ├── hooks/
│       │   ├── useGraph.js     ← Carga el subgrafo desde la API
│       │   └── useSearch.js    ← Búsqueda con debounce
│       └── services/
│           └── api.js          ← Axios configurado
│
└── data/
    └── scripts/
        └── ingest_chilecompra.js  ← Ingesta desde API de ChileCompra
```

---

## Setup rápido

### 1. Base de datos

```bash
# Crear la base de datos
createdb mapapoderlatam

# Aplicar el schema
psql mapapoderlatam < backend/config/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Editar .env con tu DATABASE_URL

npm install
npm run seed   # Carga datos de ejemplo
npm run dev    # Servidor en http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev    # App en http://localhost:5173
```

---

## API

| Endpoint | Descripción |
|---|---|
| `GET /api/search?q=nombre` | Búsqueda fulltext de nodos |
| `GET /api/graph/:id?depth=2` | Subgrafo hasta N grados |
| `GET /api/graph/:id/stats` | Estadísticas del nodo |

### Ejemplo de respuesta — `/api/graph/1?depth=2`

```json
{
  "nodes": [
    { "id": 1, "type": "person", "name": "Carlos Fuentes Muñoz", "is_root": true, "risk_score": 40 },
    { "id": 5, "type": "company", "name": "Constructora Los Andes SpA", "is_root": false }
  ],
  "edges": [
    { "source_id": 1, "target_id": 5, "type": "owns", "label": "Socio fundador (40%)" }
  ]
}
```

---

## Tipos de nodos y relaciones

**Nodos:** `person` (morado) · `company` (verde) · `contract` (naranja)

**Relaciones:** `owns` · `awarded` · `signed` · `donated_to` · `family_of` · `former_role`

---

## Fuentes de datos LATAM

| País | Portal | Tipo de datos |
|---|---|---|
| Chile | api.mercadopublico.cl | Contratos públicos |
| Perú | datosabiertos.gob.pe | Licitaciones SEACE |
| Colombia | secop.gov.co | Contratos SECOP I/II |
| México | compranet.gob.mx | Compranet |
| Brasil | compras.gov.br | ComprasNet |

---

## Pitch en 30 segundos

> "Esta información ya existe, dispersa en portales públicos. Nosotros la conectamos.
> Ingresa cualquier nombre y ve en segundos si hay conflictos de interés que ningún periodista había podido visualizar antes."
