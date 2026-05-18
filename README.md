# RedPoder LATAM

> Los datos están a la vista. Nosotros revelamos lo que esconden.

Plataforma de transparencia anticorrupción para Latinoamérica desarrollada para hackathon. Permite explorar redes entre funcionarios públicos, empresas y contratos en **Chile, México, Perú y Colombia** — y, a diferencia de los agregadores de datos existentes, **interpreta** la información usando IA y reglas determinísticas.

- 🇨🇱 Chile · 🇲🇽 México · 🇵🇪 Perú · 🇨🇴 Colombia
- 6 casos demostrativos cubriendo puerta giratoria, conflicto familiar, empresa fantasma, donación canalizada y voto sin abstención
- Interfaz bilingüe ES / EN
- Cumplimiento con marco de Ley 21.719 (Chile, datos personales) — derecho de apelación incluido

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + Tailwind + SVG nativo |
| Visualizaciones | SVG con algoritmos `layeredLayout` (barycenter ordering) y `radialTreeLayout` (sunburst con greedy sector ordering) |
| Backend | Python 3.12+ con FastAPI + Uvicorn |
| IA | Anthropic Claude Sonnet 4.6 vía SDK oficial (`anthropic>=0.40`) |
| Persistencia | JSONL append-only para apelaciones (demo) · MySQL preparado para producción |
| Cache | In-memory dict (backend) + Map JS (frontend), keyed por `caseId:lang` |

---

## Setup en local

### 1. Clonar y entrar al repo

```bash
git clone git@github.com:RenatoBarra3236/mapapoderlatam.git
cd mapapoderlatam
git checkout Diseño_visual
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Editá backend/.env y agregá tu ANTHROPIC_API_KEY (sk-ant-...)
cd ..
```

### 3. Frontend

```bash
cd frontend
npm install
cd ..
```

### 4. Correr ambos servicios

**Opción A — script único (recomendado):**

```bash
./start.sh
```

Levanta backend (puerto 3001) y frontend (puerto 5173) en background, con limpieza automática al hacer `Ctrl-C`. Logs en `/tmp/redpoder-*.log`.

**Opción B — dos terminales:**

```bash
# terminal 1
cd backend && source venv/bin/activate && python -m uvicorn app:app --reload --port 3001

# terminal 2
cd frontend && npm run dev
```

Abrí [http://localhost:5173/](http://localhost:5173/) en el navegador.

---

## Características principales

### 4 vistas del grafo

| Vista | Algoritmo | Cuándo es útil |
|---|---|---|
| **Red Neuronal** | Layered DAG con barycenter ordering | Para ver flujos de poder por grado de cercanía |
| **Órbitas** | Radial tree con greedy sector ordering | Para ver el peso relativo de cada rama familiar/empresarial |
| **Línea de tiempo** | Cronológico | Para ver la secuencia de eventos |
| **Tabla** | Lista plana | Para auditoría detallada de cada vínculo |

Las dos vistas de grafo usan **SVG directo** (no Vis.js) para preservar fidelidad visual: glow radial, partículas de fondo, pulse del nodo raíz, sector wedges, arcos chord, atenuación por hover.

### Análisis con IA (Claude Sonnet 4.6)

Dos endpoints:

- **`GET /api/ai/summary/{caseId}?lang=es`** — devuelve `{summary, flags[]}` en JSON estructurado. Claude analiza el subgrafo y redacta el resumen en lenguaje natural, citando montos y leyes específicas del país.
- **`POST /api/ai/chat/{caseId}`** — body `{question, lang, history?}`. Chatbot conversacional anclado al subgrafo. **No mezcla jurisdicciones**: si el caso es de México, solo cita leyes mexicanas aunque la pregunta intente desviarlo.

**Cache de 2 capas** para reducir consumo de API:
- Backend: dict in-memory persistente entre requests, key `caseId:lang`.
- Frontend: `Map` en scope del módulo, sobrevive a remounts.
- Resultado: la 2ª visita a un caso ya cargado es **~1000× más rápida** (de 30s a 30ms).

### Reglas determinísticas (sin IA)

`backend/controllers/flags_controller.py` implementa 5 detectores puros que disparan banderas rojas con evidencia hardcoded en `{es, en}`:

1. **Puerta giratoria** — ex-funcionario pasa a empresa adjudicataria durante su gestión
2. **Conflicto familiar** — root tiene `family_of` con persona vinculada por `owns/signed` a algo que toca al root
3. **Empresa fantasma** — empresa constituida < 180 días antes de su primera adjudicación
4. **Donación canalizada** — chain `family_of → owns → donated_to → middleman → donated_to → root`
5. **Voto sin abstención** — persona vota en entidad y tiene `family_of` con dueño/socio relacionado

Cada flag **cita la ley del país del caso**:

| Regla | 🇨🇱 Chile | 🇲🇽 México | 🇵🇪 Perú | 🇨🇴 Colombia |
|---|---|---|---|---|
| Puerta giratoria | Ley 20.880 + modernización | LGRA Art. 60 | Ley 27815 | Ley 1474 de 2011 |
| Conflicto familiar | Ley 20.880 | LGRA Art. 58 | Ley 27815 Art. 8 | Ley 1474 Art. 8 |
| Empresa fantasma | SII + Mercado Público | SAT + CompraNet | SUNAT + SEACE | DIAN + SECOP II |
| Donación canalizada | Servel + CPLT | INE | ONPE + Ley 28094 | CNE + Ley 1475 |
| Voto sin abstención | Ley 20.880 + Cámara | LOC Art. 8 | Reglamento Congreso | Ley 5 de 1992 |

### Cumplimiento Ley 21.719 (datos personales · Chile)

La modernización chilena de datos personales (vigencia plena diciembre 2026, idNorma 1209272) exige derechos efectivos para los titulares. Implementado:

- **Modal "Avisos legales y privacidad"** — accesible desde el botón `ⓘ` del topbar y el footer del empty state.
- **Aviso de análisis algorítmico** — el `risk_score` muestra `· algoritmo` con tooltip explicando que es interpretación automatizada sujeta a revisión humana.
- **Endpoint de apelación** `POST /api/appeals/{caseId}` — recibe solicitudes ARCOPOL (Acceso, Rectificación, Cancelación, Oposición, Portabilidad, Bloqueo, Revisión humana). Genera ticket único `AP-YYYYMMDD-XXXXXXXX` y persiste a `backend/data/appeals.log.jsonl`.
- **Botón "Solicitar revisión / apelar"** en el panel derecho de cada caso, abre un modal con formulario completo en ES/EN.

---

## API endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/ai/summary/{caseId}?lang=es` | Resumen IA + flags estructurados. Cacheado. |
| POST | `/api/ai/chat/{caseId}` | Chat conversacional. Body `{question, lang, history?}`. |
| GET | `/api/flags/{caseId}?lang=es` | Banderas rojas determinísticas (reglas hard-coded). |
| POST | `/api/appeals/{caseId}` | Solicitud ARCOPOL del titular. Body `{request_type, relation, name, contact, description, lang}`. |
| GET | `/api/graph/{nodeId}?depth=2` | (legacy MySQL) Subgrafo hasta N grados. |
| GET | `/api/search?q=...` | (legacy MySQL) Búsqueda LIKE. |

Docs interactivos en [http://localhost:3001/docs](http://localhost:3001/docs).

La búsqueda real del demo es **local en el frontend** sobre `SEARCH_INDEX` (en `frontend/src/lib/demoData.js`).

---

## Casos demostrativos

| Caso | País | Root | Patrón principal |
|---|---|---|---|
| `fuentes` | 🇨🇱 CL | Carlos Fuentes Saavedra | Puerta giratoria MOP → Constructora Los Andes |
| `errazuriz` | 🇨🇱 CL | María José Errázuriz Pinto | Voto sin abstención + donación canalizada (minería) |
| `losandes` | 🇨🇱 CL | Servicios Patagonia Express SpA | Empresa fantasma CONAF |
| `salinas` | 🇲🇽 MX | Genaro Salinas Maldonado | Puerta giratoria CFE eléctrica |
| `espinoza` | 🇵🇪 PE | Carmen Espinoza Vargas | Concesiones viales + lobby |
| `valencia` | 🇨🇴 CO | Servicios Atlantic SAS | Empresa fantasma COVID/MinSalud |

Los casos son **ficticios** (ver disclaimer legal en la app). Modelan patrones reales documentados en la región.

---

## Estructura del proyecto

```
mapapoderlatam/
├── README.md                          ← este archivo
├── CLAUDE.md                          ← contexto para Claude Code
├── start.sh                           ← script de arranque
│
├── backend/
│   ├── app.py                         ← FastAPI entry
│   ├── requirements.txt
│   ├── .env.example
│   ├── config/
│   │   ├── database.py                ← MySQL session (para producción)
│   │   └── settings.py                ← env vars con Pydantic
│   ├── models/                        ← SQLAlchemy (nodes, edges)
│   ├── routes/
│   │   ├── ai.py                      ← /api/ai/summary, /api/ai/chat
│   │   ├── flags.py                   ← /api/flags/{caseId}
│   │   ├── appeals.py                 ← /api/appeals/{caseId}
│   │   ├── graph.py                   ← /api/graph (legacy MySQL)
│   │   └── search.py                  ← /api/search (legacy MySQL)
│   ├── controllers/
│   │   ├── ai_controller.py           ← Claude prompts + cache + jurisdiction anchor
│   │   ├── flags_controller.py        ← 5 reglas + LEGAL_SOURCES por país
│   │   ├── appeals_controller.py      ← validación + persistencia JSONL
│   │   └── graph_controller.py
│   ├── data/
│   │   ├── demo_cases.py              ← los 6 casos (mirror de frontend/demoData.js)
│   │   └── appeals.log.jsonl          ← gitignored, log de apelaciones
│   └── utils/
│       └── claude_client.py           ← cliente Anthropic con prompt caching
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── index.css                  ← tokens + estilos editoriales
        ├── pages/
        │   └── MapaPage.jsx           ← layout principal
        ├── components/
        │   ├── topbar/                ← Topbar, SearchBar
        │   ├── canvas/                ← NeuralView, OrbitView, TimelineView, TableView, CanvasTabs, EmptyState
        │   ├── panel/                 ← RightPanel, ProfileHead, AISummary, FlagCard
        │   ├── chatbot/               ← ChatbotDrawer, fakeAnswer (fallback offline)
        │   ├── legal/                 ← LegalNoticeModal, AppealModal
        │   └── tweaks/                ← TweaksPanel + 4 paletas
        ├── hooks/
        │   ├── useAISummary.js        ← fetch + Map cache
        │   └── useRuleFlags.js
        ├── lib/
        │   ├── demoData.js            ← los 6 casos
        │   ├── i18n.js                ← strings ES/EN
        │   ├── layouts/
        │   │   ├── layered.js         ← layout neural
        │   │   └── radialTree.js      ← layout órbitas
        │   └── graph/
        │       ├── useStage.js        ← pan + zoom + dims hook
        │       └── utils.js
        └── services/
            └── api.js                 ← fetch + postChat + postAppeal
```

---

## Decisiones técnicas no obvias

- **SVG en vez de Vis.js para los grafos**. El stack original lo asumía pero el reference design usa SVG con efectos (glow radial, partículas, pulse animado, chord arcs) que Vis.js no reproduce. Las posiciones de nodos vienen de algoritmos puros (`layeredLayout` con barycenter ordering, `radialTreeLayout` con greedy sector ordering) que evitan el "force-directed" genérico que se ve en plataformas competidoras.

- **Cache de Claude eterno (sin TTL)**. Los casos demo son estáticos: una vez generado el summary, vale para siempre. Si en el futuro hay datos dinámicos se agrega TTL.

- **Reglas determinísticas + IA, no solo IA**. Las reglas son auditables y explicables, lo que les da credibilidad periodística. La IA solo agrega el resumen narrativo. Periodistas y fiscales confían más en una regla que dice "constituida 18 días antes de adjudicar el contrato" que en un score opaco.

- **Anclaje de jurisdicción en el prompt del chat**. El system prompt del chatbot incluye el país del caso y la lista exacta de leyes/instituciones válidas, con instrucción explícita de no mencionar otros países. Bloquea cross-contamination jurisdiccional.

- **IDs únicos por match en las reglas**. Antes las reglas usaban IDs constantes (`rule-revolving`), lo que generaba duplicate keys en React cuando la regla disparaba varias veces. Ahora cada match tiene ID derivado de los actores específicos (`rule-revolving-{rootId}-{entityId}-{companyId}-{contractId}`).

- **Cache de frontend se guarda ANTES del check de cancelled**. La race condition al cambiar rápido de caso (A → B → A) descartaba la respuesta de A si el usuario ya se había ido a B. Fix: `summaryCache.set(...)` se ejecuta en `.then()` antes del early-return por cancelación, garantizando que el dato quede disponible para la próxima visita.

---

## Limitaciones conocidas

- **Datos ficticios**. Los 6 casos son inventados (claramente declarado en avisos legales). Para producción habría que conectar fuentes públicas reales: ChileCompra/Mercado Público, OCDS, Servel, CPLT, InfoTransparencia, ICIJ Offshore Leaks, OpenCorporates, OpenSanctions, SECOP II, CompraNet, SEACE, etc.

- **Backend no usa la BD MySQL todavía**. Las rutas `/api/graph` y `/api/search` están preparadas para MySQL pero la demo lee desde `demo_cases.py`. Para producción hay que correr `python init_db.py` + seeders + ajustar las rutas de IA para que carguen desde BD.

- **Apelaciones se guardan en JSONL local**. Para producción: cola de tickets (Linear, Jira) + email automático al titular + admin endpoint para listar/atender.

- **Las llamadas a Claude no están firmadas con cláusulas contractuales de transferencia internacional**. El aviso legal lo declara pero el contrato formal con Anthropic queda fuera del scope hackathon.

- **Python 3.14 requiere las versiones actualizadas de pydantic / fastapi del `requirements.txt`**. Si el equipo usa 3.11–3.12 también funciona con esas versiones, pero algunas máquinas con Python 3.14 muy reciente necesitan las versiones bumpeadas.

---

## Troubleshooting

**`npm install` falla con ENOENT package.json**
→ Tu compañero corrió `npm install` desde `backend/` por error. Tiene que estar en `frontend/`.

**`cp .env.example .env` da error en Windows**
→ Usá `copy` (CMD) o `Copy-Item` (PowerShell), o creá el archivo a mano en VS Code.

**Puerto 3001 ocupado al iniciar backend**
→ `lsof -ti :3001 | xargs kill -9` (Mac/Linux). El `start.sh` ya lo hace solo.

**La página queda en negro al abrir Órbitas**
→ Probablemente cache del navegador con un bundle viejo. Hard refresh con `Cmd/Ctrl + Shift + R`.

**El AI summary se sigue regenerando al volver a un caso ya visitado**
→ Asegurate de que el backend esté corriendo y la API key sea válida. El cache se llena solo cuando hay un fetch exitoso; sin backend, cache miss permanente.

**Claude responde mezclando países**
→ No debería pasar (hay anclaje de jurisdicción en el system prompt). Si pasa, reportar el caso porque es bug del prompt — debería citar solo leyes del país del caso abierto.

---

## Licencias y créditos

Proyecto desarrollado para hackathon LATAM "Transparency & Corruption". Diseño editorial con tipografías IBM Plex Sans, IBM Plex Mono y Source Serif 4.

Análisis de IA: Anthropic Claude. Datos públicos: fuentes oficiales nacionales según jurisdicción.

---

## Roadmap

**Completado (alcance hackathon)**:
- [x] 6 casos en 4 países LATAM
- [x] 4 vistas (red neuronal, órbitas, timeline, tabla)
- [x] AI summary + flags determinísticas + chatbot
- [x] Cache 2 capas (backend + frontend)
- [x] Tweaks panel (tema, paleta, densidad)
- [x] Avisos legales + apelación ARCOPOL

**Para producción**:
- [ ] Conexión a fuentes públicas reales (ChileCompra, OCDS, Servel, etc.)
- [ ] Seed MySQL + migración del backend a BD
- [ ] Cola de tickets para apelaciones + notificación DPO
- [ ] Endpoint admin para listar/atender apelaciones
- [ ] PDF exportable del caso para periodistas
- [ ] Streaming en el chatbot (SSE)
- [ ] Tests automatizados (pytest + vitest)
- [ ] Deploy a producción con HTTPS + dominio
- [ ] Análisis de patrimonio inconsistente (requiere datos extra del subgrafo)
- [ ] Detección de lobby tardío (requiere `declared_date` en el dato)
