# INFO_PROYECTO

## Resumen general

`mapapoderlatam` es una plataforma de transparencia orientada a visualizar redes de poder politico, empresarial y contractual en Latinoamerica. Su objetivo es conectar personas, empresas, organismos y contratos publicos para detectar posibles conflictos de interes, puertas giratorias, relaciones familiares relevantes, donaciones, adjudicaciones y otros patrones de riesgo.

El producto combina dos partes:

- Un frontend interactivo que muestra casos de investigacion como grafos, lineas de tiempo, tablas de relaciones, paneles de riesgo y un asistente simulado.
- Un backend API que modela nodos y relaciones en una base MySQL, permite buscar entidades y obtener subgrafos centrados en un nodo.

En el estado actual del repositorio, el frontend funciona principalmente con datos de demostracion definidos localmente en `frontend/src/lib/demoData.js`. El backend ya existe con FastAPI y MySQL, pero el frontend actual no consume sus endpoints todavia; usa `DEMO_CASES` y `SEARCH_INDEX` directamente.

## Que hace el proyecto

La aplicacion permite explorar perfiles o casos de riesgo mediante una interfaz visual. Al seleccionar o buscar un caso, el usuario puede ver:

- Entidades involucradas: personas, empresas, contratos y organismos.
- Relaciones entre entidades: propiedad, adjudicacion, firma, vinculo familiar, donacion y cargo previo.
- Indicadores de riesgo por nodo.
- Relaciones marcadas como sospechosas o relevantes.
- Resumen narrativo tipo IA.
- Banderas rojas con evidencia y fuente referencial.
- Linea de tiempo de eventos.
- Tabla estructurada de relaciones.
- Chat simulado para responder preguntas sobre el caso.

Los casos demo actuales son ficticios y estan enfocados en Chile:

- `fuentes`: ex funcionario publico relacionado con empresa adjudicataria y vinculos familiares.
- `errazuriz`: diputada con vinculos familiares y donaciones relacionadas al sector minero.
- `losandes`: empresa adjudicataria de emergencia constituida poco antes del contrato.

## Arquitectura

La estructura principal es:

```text
mapapoderlatam/
├── backend/                  # API Python FastAPI + SQLAlchemy + MySQL
├── frontend/                 # App React + Vite
├── data/scripts/             # Script experimental de ingesta ChileCompra
├── README.md                 # Documentacion inicial, parcialmente desactualizada
├── MIGRATION_SUMMARY.md      # Resumen de migracion Node/PostgreSQL a FastAPI/MySQL
└── INFO_PROYECTO.md          # Este documento
```

La arquitectura prevista es:

```text
Usuario
  ↓
Frontend React/Vite
  ↓ /api mediante proxy de Vite o VITE_API_URL
Backend FastAPI
  ↓
SQLAlchemy
  ↓
MySQL
```

En la implementacion actual, el frontend no llama a la API: renderiza datos locales de demo. El backend puede ejecutarse y probarse por separado con sus endpoints.

## Stack completo

### Frontend

- Lenguaje: JavaScript / JSX.
- Framework UI: React `18.3.1`.
- Build tool/dev server: Vite `5.4.2`.
- Estilos: CSS propio en `frontend/src/index.css`, con Tailwind configurado.
- Tailwind CSS: `3.4.10`.
- PostCSS: `8.4.41`.
- Autoprefixer: `10.4.20`.
- Visualizacion de grafos: SVG custom en componentes React.
- Dependencia disponible pero no usada en la vista actual: `vis-network 9.1.9`.
- HTTP client instalado: `axios 1.7.2`, aunque no se usa actualmente en `frontend/src`.
- Persistencia local: `localStorage` para idioma, tema, paleta y densidad.

### Backend

- Lenguaje: Python.
- Framework API: FastAPI `0.109.0`.
- Servidor ASGI: Uvicorn `0.27.0`.
- ORM/conexion DB: SQLAlchemy `2.0.25`.
- Driver MySQL: PyMySQL `1.1.0`.
- Configuracion por entorno: `python-dotenv`, `pydantic-settings`.
- Validacion/configuracion: Pydantic `2.5.0`.
- Integracion IA preparada: SDK `anthropic 0.21.0`.
- Base de datos: MySQL/MariaDB.

### Base de datos

El modelo principal es un grafo persistido en dos tablas:

- `nodes`: representa personas, empresas y contratos.
- `edges`: representa relaciones dirigidas entre nodos.

Tambien existe la vista:

- `node_degree`: calcula grados de entrada, salida y total por nodo.

### Datos e ingesta

- Datos backend de ejemplo: `backend/utils/seed.py`.
- Datos frontend de demo: `frontend/src/lib/demoData.js`.
- Script de ingesta ChileCompra: `data/scripts/ingest_chilecompra.js`.

Importante: el script `data/scripts/ingest_chilecompra.js` parece heredado de la version Node/PostgreSQL. Requiere `backend/config/db`, que no existe en el backend actual, y usa sintaxis SQL tipo PostgreSQL (`ON CONFLICT`, `$1`, `FROM` en `UPDATE`). Por eso no esta alineado con la migracion actual a FastAPI/MySQL.

## Funcionamiento del frontend

El punto de entrada es:

```text
frontend/src/main.jsx
```

Este renderiza `MapaPage`, que coordina toda la experiencia:

```text
frontend/src/pages/MapaPage.jsx
```

### Flujo principal

1. La app inicia sin caso seleccionado.
2. Se muestra una pantalla inicial con casos sugeridos.
3. El usuario puede elegir un caso o buscar en el indice local.
4. Al elegir un caso, se cargan los datos desde `DEMO_CASES`.
5. La vista central muestra el grafo o una representacion alternativa.
6. El panel derecho muestra perfil, resumen IA y banderas rojas.
7. El chatbot simulado responde en base al caso seleccionado.

### Componentes principales

- `Topbar`: barra superior con marca, busqueda, idioma, tema y panel de ajustes.
- `SearchBar`: busqueda local con debounce sobre `SEARCH_INDEX`.
- `EmptyState`: pantalla inicial con casos sugeridos.
- `CanvasTabs`: selector de vistas.
- `NeuralView`: visualizacion tipo red/neural con SVG.
- `OrbitView`: visualizacion radial por grados de relacion.
- `TimelineView`: eventos del caso en orden temporal.
- `TableView`: tabla de relaciones.
- `RightPanel`: panel lateral de perfil, resumen y banderas rojas.
- `ChatbotDrawer`: chat simulado.
- `TweaksPanel`: ajustes de tema, paleta y densidad.

### Vistas disponibles

- Red/neural: posiciona nodos por capas y muestra conexiones curvas.
- Orbital: distribuye nodos por grados alrededor del nodo raiz.
- Linea de tiempo: lista eventos con severidad.
- Tabla: muestra relaciones en formato tabular.

### Internacionalizacion

La app soporta:

- Espanol (`es`)
- Ingles (`en`)

Los textos principales estan en:

```text
frontend/src/lib/i18n.js
```

### Temas y ajustes visuales

`MapaPage` guarda preferencias en `localStorage` bajo la clave:

```text
mapapoder.tweaks
```

Las preferencias incluyen:

- Idioma.
- Tema claro/oscuro.
- Paleta visual.
- Densidad de interfaz.

## Funcionamiento del backend

El punto de entrada es:

```text
backend/app.py
```

La aplicacion FastAPI:

- Carga variables de entorno con `dotenv`.
- Inicializa settings mediante Pydantic.
- Activa CORS abierto.
- Expone health check.
- Registra rutas de grafo y busqueda.

### Endpoints

#### Health check

```http
GET /api/health
```

Responde:

```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

#### Buscar nodos

```http
GET /api/search?q=carlos&limit=10
```

Parametros:

- `q`: texto de busqueda, minimo 2 caracteres.
- `type`: filtro opcional por tipo de nodo.
- `country`: filtro opcional por pais.
- `limit`: maximo de resultados, hasta 100.

La busqueda actual usa `LIKE`/`ilike` sobre `Node.name`, no el indice fulltext del schema SQL.

#### Obtener subgrafo

```http
GET /api/graph/{node_id}?depth=2
```

Devuelve nodos y relaciones conectadas al nodo indicado. El controlador intenta usar CTE recursivo y limita `depth` a un maximo de 3.

#### Estadisticas de nodo

```http
GET /api/graph/{node_id}/stats
```

Devuelve:

- Grado de salida.
- Grado de entrada.
- Grado total.
- Cantidad de contratos relacionados por relacion `awarded`.
- Monto total calculado desde metadata.
- Risk score.

### Modelo de datos backend

#### Tabla `nodes`

Campos principales:

- `id`: identificador interno.
- `external_id`: identificador externo, por ejemplo RUT o codigo de contrato.
- `type`: `person`, `company` o `contract`.
- `name`: nombre visible.
- `country`: codigo de pais, por defecto `CL`.
- `metadata`: JSON flexible para atributos adicionales.
- `risk_score`: puntaje numerico de riesgo.
- `created_at`: fecha de creacion.

#### Tabla `edges`

Campos principales:

- `id`: identificador interno.
- `source_id`: nodo origen.
- `target_id`: nodo destino.
- `type`: tipo de relacion.
- `label`: descripcion humana.
- `weight`: peso o magnitud.
- `source_url`: fuente.
- `valid_from`: inicio de vigencia.
- `valid_to`: fin de vigencia.
- `metadata`: JSON flexible.
- `created_at`: fecha de creacion.

#### Tipos de relacion usados

- `owns`: posee, controla o dirige.
- `awarded`: adjudico o fue adjudicatario.
- `signed`: firmo o participo formalmente.
- `donated_to`: dono a.
- `family_of`: vinculo familiar.
- `former_role`: cargo previo.

## Datos de ejemplo

El backend carga datos con:

```bash
cd backend
python init_db.py
```

Esto crea tablas y carga:

- 4 personas.
- 3 empresas.
- 3 contratos.
- 10 relaciones.

El frontend, por su parte, usa un set mas rico de casos ficticios en:

```text
frontend/src/lib/demoData.js
```

Estos datos incluyen nodos, edges, timeline, flags y summaries bilingues.

## Integracion IA

Hay dos niveles de IA en el repositorio:

1. Frontend:
   - El chat es simulado.
   - Usa `frontend/src/components/chatbot/fakeAnswer.js`.
   - Responde con reglas deterministicas sobre el caso actual.

2. Backend:
   - Existe `backend/utils/claude_client.py`.
   - Usa `AsyncAnthropic`.
   - Modelo por defecto: `claude-sonnet-4-6`.
   - Soporta `system` con `cache_control` ephemeral.
   - No hay endpoint expuesto actualmente que conecte el frontend con esta utilidad.

## Variables de entorno

### Backend

Archivo ejemplo:

```text
backend/.env.example
```

Variables:

```env
PORT=3001
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/mapapoderlatam
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Frontend

Archivo ejemplo:

```text
frontend/.env.example
```

Variable:

```env
VITE_API_URL=http://localhost:3001/api
```

Nota: aunque existe `VITE_API_URL`, el codigo actual del frontend no la usa para cargar datos.

## Como ejecutar

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python init_db.py
python -m uvicorn app:app --reload --port 3001
```

API local:

```text
http://localhost:3001
```

Swagger:

```text
http://localhost:3001/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App local:

```text
http://localhost:5173
```

Vite tiene proxy configurado para redirigir `/api` hacia:

```text
http://localhost:3001
```

## Estado actual y observaciones tecnicas

- El proyecto fue migrado de Node.js/PostgreSQL a Python FastAPI/MySQL, segun `MIGRATION_SUMMARY.md`.
- `README.md` aun describe partes de la arquitectura antigua, por ejemplo Express, PostgreSQL y archivos `db.js`/`src`, que ya no representan el backend actual.
- El backend actual esta en `backend/` con FastAPI, SQLAlchemy y PyMySQL.
- El frontend actual es una demo visual autocontenida y no consume el backend.
- `axios` y `vis-network` estan instalados, pero el codigo actual usa datos locales y graficos SVG propios.
- La utilidad de Claude esta preparada en backend, pero no integrada a rutas API.
- El script de ingesta ChileCompra parece desactualizado respecto al stack actual.
- La busqueda backend menciona full-text en comentarios/schema, pero el controlador usa `LIKE`/`ilike`.
- El campo `depth` del endpoint de grafo se limita a 3, aunque la consulta actual no usa claramente ese valor para cortar la recursion.

## Proposito del producto

El proyecto apunta a ser una herramienta de analisis publico-investigativo: toma informacion que normalmente esta dispersa en portales publicos y la presenta como una red navegable. Su valor esta en hacer visibles conexiones que pueden ser dificiles de detectar en tablas separadas: empresas relacionadas con funcionarios, contratos adjudicados, familiares, donaciones, cargos previos y eventos temporales.

En su forma actual, funciona como prototipo/demo avanzado de interfaz y como base API separada para persistir y consultar grafos reales.
