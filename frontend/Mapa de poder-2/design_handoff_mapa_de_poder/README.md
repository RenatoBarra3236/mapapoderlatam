# Handoff — Mapa de Poder LATAM

Diseño high-fidelity para la plataforma de transparencia anticorrupción del hackathon LATAM. Este paquete contiene todo lo necesario para que un desarrollador (humano o Claude Code) reproduzca el diseño **1:1** en el stack real del proyecto (FastAPI + React + Vite + Tailwind + Vis.js).

---

## ⚠️ Cómo usar este paquete con Claude Code (LEE PRIMERO)

El error más común es decirle a Claude Code "haz que se vea como este HTML" sin más contexto — termina improvisando y el resultado se ve genérico. Para que reproduzca el diseño exactamente:

### Paso 1 — Copia esta carpeta dentro de tu repo
```bash
cp -r design_handoff_mapa_de_poder/ mapapoderlatam/frontend/
```

### Paso 2 — Abre el HTML standalone en tu navegador como referencia visual
Doble-clic en `Mapa de Poder — Standalone.html`. Manténlo abierto en otra pestaña mientras Claude Code trabaja. Esa es la **fuente de verdad visual**. NO es el código de producción, solo la referencia.

### Paso 3 — Usa este prompt al iniciar Claude Code

> Lee `frontend/design_handoff_mapa_de_poder/README.md` antes de cualquier cambio.
> 
> Vas a implementar el diseño de la plataforma Mapa de Poder LATAM en este repo (React + Vite + Tailwind + Vis.js).
>
> **Reglas no negociables:**
> 1. Sigue el README al pie de la letra. Si hay un valor numérico, color, fuente, tamaño o algoritmo especificado, úsalo exactamente.
> 2. Los archivos en `reference/` son la fuente de verdad. Léelos antes de escribir código. NO los copies tal cual (están en JSX con Babel inline, tu stack es distinto), sino tradúcelos a la convención del repo (React + Tailwind + componentes existentes en `frontend/src/components/`).
> 3. NO agregues secciones, copy ni features que no estén en el diseño. NO uses gradientes vistosos, iconografía decorativa, ni emojis (excepto los ya documentados en el README).
> 4. NO reemplaces el algoritmo de layout radial-tree ni el layered con barycenter ordering. Pórtalos JS → JS, son código puro sin dependencias.
> 5. Para el grafo: el repo usa Vis.js. Mantén Vis.js pero pásale las posiciones que calculan los algoritmos del README (Vis.js soporta `physics: false` + nodos con `x, y` fijos). NO uses el force-directed de Vis.js por default — eso es lo que da el look de DeQuiénes.cl, exactamente lo que queremos diferenciar.
> 6. Implementa una vista a la vez en este orden: shell → búsqueda → vista Red Neuronal → panel derecho (perfil + IA + red flags) → vista Órbitas → vista Timeline → vista Tabla → chatbot → tweaks. Tras cada vista, detente y muestra el resultado antes de seguir.
> 7. Si algo del README es ambiguo, pregunta antes de improvisar.

### Paso 4 — Verifica cada vista contra el standalone HTML
Después de cada vista terminada, compara lado a lado tu implementación contra `Mapa de Poder — Standalone.html`. Si algo se ve distinto, dile a Claude Code: *"compara con el HTML standalone — algo en [X componente] no coincide"*.

---

## Sobre estos archivos

Los archivos en `reference/` son **prototipos de diseño**, no código de producción. Están escritos en JSX con Babel transpilado en navegador (sin build pipeline), usan CSS variables y SVG custom para los grafos. **Tu trabajo es traducirlos al stack real del proyecto** (FastAPI backend ya existe; frontend en React + Vite + Tailwind + Vis.js).

`Mapa de Poder — Standalone.html` es el archivo ya bundled — puedes abrirlo en cualquier navegador sin servidor y funciona idéntico. Úsalo como referencia visual permanente.

---

## Fidelidad

**High-fidelity.** Colores, tipografía, espaciados, animaciones y comportamientos están todos definidos con precisión y deben reproducirse 1:1.

---

## Stack objetivo (del CLAUDE.md original)

| Capa | Tecnología | Notas para el handoff |
|---|---|---|
| Frontend | React + Vite + Tailwind | Usa los componentes existentes en `frontend/src/components/` cuando sirvan |
| Grafo | Vis.js Network | Configurar con `physics: false` y posiciones calculadas por el algoritmo del README |
| Backend | FastAPI + MySQL (ya existe) | No tocar |
| IA | Claude API (`claude-sonnet-4-20250514`) | Para resumen + red flags + chatbot |

---

## 🎨 Design Tokens

### Colores (claro / oscuro)

```css
/* LIGHT MODE */
--bg:        #FAF8F3;  /* off-white cálido */
--bg-2:      #F1EEE6;
--bg-3:      #E6E2D7;
--surface:   #FFFFFF;
--ink:       #14110D;  /* texto principal */
--ink-2:     #3A352D;
--ink-3:     #6A6256;  /* texto secundario/labels mono */
--line:      #D9D4C6;
--line-2:    #ECE7DB;

/* DARK MODE */
--bg:        #0F0E0B;
--bg-2:      #16140F;
--bg-3:      #201D17;
--surface:   #1A1813;
--ink:       #F2EFE6;
--ink-2:     #C9C3B4;
--ink-3:     #8A8270;
--line:      #2C2820;
--line-2:    #221F19;

/* COLORES DE GRAFO (compartidos, ajustados en dark) */
/* light */
--c-person:   #534AB7;  /* morado — personas */
--c-company:  #0F6E56;  /* teal — empresas */
--c-contract: #993C1D;  /* coral — contratos */
--c-alert:    #A32D2D;  /* rojo — vínculos marcados / red flags */
--c-warn:     #B8861B;  /* ámbar — severidad media */

/* dark (más luminosos para contraste sobre fondo oscuro) */
--c-person:   #8C84E2;
--c-company:  #4FB18F;
--c-contract: #D27151;
--c-alert:    #E26F6F;
--c-warn:     #E5B86B;
```

Para Tailwind: agrégalos en `tailwind.config.js` extend.colors y usa CSS variables como valores (`var(--c-person)`) para que el toggle de tema sea automático.

### Tipografía

```css
--font-sans:  "IBM Plex Sans", system-ui, -apple-system, sans-serif;
--font-serif: "Source Serif 4", Georgia, serif;     /* títulos editoriales, resumen IA, evidencia */
--font-mono:  "IBM Plex Mono", ui-monospace, monospace; /* labels, eyebrows, datos numéricos */
```

Importa desde Google Fonts:
```
https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;1,8..60,400&display=swap
```

**Reglas tipográficas:**
- Nombres de personas/empresas en cards de perfil → `--font-serif`, 26px, weight 500
- Resumen IA y evidencia de red flags → `--font-serif`, 13.5-15px, line-height 1.55, color `--ink-2`
- Labels de sección (eyebrows) → `--font-mono`, 10.5-11px, uppercase, letter-spacing 0.08-0.1em
- Datos numéricos (riesgo, montos, fechas) → `--font-mono`
- Todo lo demás → `--font-sans`

### Espaciado

```css
--pad-1: 4px;  --pad-2: 8px;   --pad-3: 12px;
--pad-4: 16px; --pad-5: 24px;  --pad-6: 32px;  --pad-7: 48px;
```

3 niveles de densidad (toggle en Tweaks):
- `compact`: pad-3=8, pad-4=12, pad-5=16, pad-6=22, pad-7=32
- `regular`: valores base de arriba
- `spacious`: pad-3=16, pad-4=22, pad-5=32, pad-6=44, pad-7=64

### Radios y sombras

```css
--radius-1: 4px;   /* botones pequeños, pills */
--radius-2: 8px;   /* cards/tablas */
--radius-3: 14px;  /* cards grandes, panels */
--radius-4: 22px;  /* botones primarios */
```

Sombras: muy sutiles. Solo en hover de cards interactivos y en search-dropdown:
```css
box-shadow: 0 12px 40px -12px color-mix(in srgb, var(--ink) 14%, transparent);
```

### Transiciones

```css
--t-fast: 120ms cubic-bezier(.2,.6,.2,1);  /* hovers, micro-interacciones */
--t-med:  240ms cubic-bezier(.2,.6,.2,1);  /* fades, slides */
--t-slow: 420ms cubic-bezier(.2,.6,.2,1);  /* aperturas de drawer */
```

---

## 🏗 Estructura de pantalla principal (single-screen app)

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOP BAR  [logo · Mapa de Poder LATAM] [search 640px max] [ES/EN][🌙]│ 60px
├──────────────────────────────────────────┬───────────────────────────┤
│ CANVAS COLUMN (1fr min-width:0)          │ RIGHT PANEL (380px fijo)  │
│ ┌─────────────────────────────────────┐ │ ┌───────────────────────┐ │
│ │ TABS  [Red Neuronal][Órbitas][Línea │ │ │ PROFILE HEAD          │ │
│ │        de tiempo][Tabla]   meta info │ │ │  Eyebrow              │ │
│ ├─────────────────────────────────────┤ │ │  Name (serif 26px)    │ │
│ │                                     │ │ │  Subtitle             │ │
│ │       CANVAS STAGE                  │ │ │  [stat cards 2-col]   │ │
│ │       (grafo radial / layered /     │ │ ├───────────────────────┤ │
│ │        timeline / tabla)            │ │ │ AI SUMMARY            │ │
│ │                                     │ │ │   (card serif)        │ │
│ │   ┌──┐                       ┌─────┐│ │ ├───────────────────────┤ │
│ │   │+ │ zoom slider           │legen││ │ │ RED FLAGS             │ │
│ │   │- │                       │  d  ││ │ │   N cards             │ │
│ │   └──┘                       └─────┘│ │ │                       │ │
│ ├─────────────────────────────────────┤ │ │                       │ │
│ │ CHATBOT DRAWER (colapsable)         │ │ │                       │ │
│ └─────────────────────────────────────┘ │ └───────────────────────┘ │
└──────────────────────────────────────────┴───────────────────────────┘
```

**CSS Grid claves:**
```css
.app { display: grid; grid-template-rows: auto 1fr; height: 100vh; }
.main { display: grid; grid-template-columns: minmax(0, 1fr) 380px; overflow: hidden; }
.canvas-col {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0; min-height: 0;
}
```
> **CRÍTICO:** `minmax(0, 1fr)` y `min-width: 0` son no-negociables — sin esto el SVG del grafo se desborda por encima del panel derecho.

---

## 📋 Estados de pantalla

### A. Empty state (sin caso seleccionado)
- Centrado en la columna canvas
- Eyebrow mono: "● Plataforma de transparencia · LATAM"
- Título serif 32px: **"DeQuiénes te muestra los datos. *Nosotros te decimos qué significan.*"** (segunda línea en italic gris)
- Subtítulo: explica que la IA detecta conflictos en segundos
- Grid 3 columnas con 3 case cards seleccionables
- Sin panel derecho ni chatbot (se ocultan)

### B. Estado con caso (caso seleccionado)
- Tabs activos en el canvas
- Panel derecho visible
- Chatbot drawer abajo (colapsado por default, max-height 52px → 360px al expandir)

---

## 🔍 Tabs del canvas

### 1. Red Neuronal (default) — `view === "neural"`

**Layout:** capas verticales por profundidad BFS desde el nodo raíz. Cada columna = un grado de cercanía (Raíz, 1°, 2°, 3°…). Conexiones como curvas Bezier horizontales suaves.

**Algoritmo de posicionamiento (porteable JS → JS):**

```js
function layeredLayout(caseData, colStep = 240, rowStep = 78) {
  // 1. BFS desde rootId para asignar profundidad a cada nodo
  const depths = bfsDepths(caseData.nodes, caseData.edges, caseData.rootId);

  // 2. Agrupar por profundidad
  const layers = groupBy(caseData.nodes, n => depths.get(n.id));
  const layerCount = max(layers.keys()) + 1;

  // 3. Ordenar cada layer con BARYCENTER HEURISTIC:
  //    para cada nodo en layer d, su barycenter = promedio del índice Y
  //    de sus vecinos en layer d-1. Ordenar por barycenter ascendente.
  //    Esto MINIMIZA cruces entre columnas adyacentes.
  for (let d = 1; d < layerCount; d++) {
    const prev = ordered[d - 1];
    const prevIdx = new Map(prev.map((n, i) => [n.id, i]));
    layers[d].sort((a, b) => barycenter(a, prevIdx) - barycenter(b, prevIdx));
  }

  // 4. Asignar posiciones: x = depth * colStep (centrado), y = layerIndex * rowStep (centrado)
}
```

**Tamaño responsive:** `colStep` y `rowStep` se calculan según el tamaño del canvas para evitar overflow. Padding lateral mínimo 130px para que los labels no se corten.

**Visual:**
- Fondo: light → `linear-gradient(180deg, var(--bg) 0%, var(--bg-2) 100%)`. Dark → radial gradient deep
- Partículas de polvo de fondo (60-80 puntos aleatorios, semilla estable por caso)
- Líneas verticales punteadas marcando cada columna (`stroke-dasharray: 1 5; opacity: 0.5`)
- Label de columna arriba en mono uppercase ("RAÍZ", "1° GRADO", etc.)
- Conexiones: doble path — uno blur (halo) detrás + uno línea — para efecto glow
- Hover sobre un nodo: ilumina sus conexiones, atenúa el resto a 7-8% opacity

### 2. Órbitas — `view === "orbit"`

**Layout:** algoritmo radial-tree (sunburst). El nodo raíz al centro; los hijos directos definen *sectores* (cuñas angulares), cada uno con una porción proporcional al tamaño de su subárbol. Las aristas del árbol nunca se cruzan.

**Algoritmo:**

```js
function radialTreeLayout(caseData, ringRadius = 150) {
  // 1. BFS spanning tree desde rootId
  const { parent, depth, children } = bfsTree(caseData);

  // 2. Sectores = hijos directos del root. Cada sector "posee" su subárbol completo.
  //    Tag cada nodo con su sectorId (el hijo de root del cual desciende).

  // 3. Ordenar sectores GREEDY para minimizar arcos cruzados:
  //    - Empieza con el sector de mayor leafCount
  //    - Iterativamente añade el sector con más chord-edges (aristas que NO
  //      son del spanning tree) hacia el último de la lista
  //    - Eso pone vecinos angulares con muchos vínculos cruzados lado a lado
  //    - Resultado: los arcos cross-sector son cortos en vez de cruzar todo el círculo

  // 4. Recursión radial: dada (startAngle, endAngle), asignar a cada hijo una
  //    porción proporcional a su leafCount. La posición es (depth*ringRadius * cos/sin(midAngle)).

  // 5. ringRadius responsive: clamp entre 90 y 170, calculado como
  //    min(canvas.w, canvas.h) / 2 - padding ÷ maxDepth
}
```

**Marcado de aristas:**
- Tree edges (parte del spanning tree): curva radial suave del padre al hijo. Línea sólida.
- Chord edges (NO parte del spanning tree, son los vínculos "interesantes" — donde suelen estar los conflictos): arco que pasa cerca del centro. Punteada `1.5 3.5`.
- Flagged edges: rojo (`--c-alert`), dashed `5 4`, con animación de stroke-dashoffset infinita.

**Visual:**
- Anillos punteados (`stroke-dasharray: 2 4; opacity: 0.55`) con label mono "1° GRADO", "2° GRADO" arriba
- Cuñas de fondo por sector: `<path>` con fill del color del tipo y `opacity: 0.04`
- Label de sector dentro de la cuña con pill de fondo `var(--bg)` opacity 0.75 + texto `◆ Nombre` mono uppercase 9.5px
- Líneas radiales punteadas separando sectores
- Root: círculo más grande (radio 22), label arriba del círculo, pulsación animada (radio crece de +8 a +18 en loop 3s)
- Pin rojo en esquina superior derecha del nodo si `risk >= 50`
- Label de aristas (`%`) siempre visible, no solo en hover: extraer cualquier patrón `\d+%` del label, o si `weight < 1` mostrar `round(weight*100)+"%"`

### 3. Línea de tiempo — `view === "timeline"`

Track vertical con dots alineados a una línea continua a la izquierda:
- Padding-left 56px en `.timeline-track`
- Línea vertical a `left: 14px` (gradient transparent → line → transparent)
- Cada item: dot circular (12px) en `left: -48px` (debe quedar centrado en la línea), `position: relative`
- Date en mono uppercase 11px gris
- Title 15px weight 500
- Note opcional en serif italic 13px gris medio
- Severidad: `info` (gris) / `warn` (ámbar) / `high` (relleno rojo)

### 4. Tabla — `view === "table"`

Tabla estándar con border-collapse, headers en mono uppercase pequeño, rows con hover bg-2. Columnas: De · Relación · Hacia · Magnitud · Marcada.

---

## 🎛 Zoom slider (en cualquier vista de grafo)

Posición: `position: absolute; bottom: 16px; left: 16px;` dentro de `.canvas-stage`. Contiene:
- Botón `＋` arriba (1.18x)
- Slider vertical (`writing-mode: vertical-lr; direction: rtl`), rango 0.35 a 2.8, step 0.02
- Botón `−` abajo
- Display de porcentaje abajo (clickeable = reset a zoom 0.92)

El estado del zoom vive en el componente del canvas. El pan (drag con mouse, solo si el target no es un nodo) se acumula sobre el zoom.

---

## 📑 Panel derecho

### Profile head
- Eyebrow: dot del tipo + "PERSONA · CL" (o COMPANY/CONTRACT)
- Nombre serif 26px, line-height 1.15, text-wrap pretty
- Subtítulo 13px ink-2
- Stat cards en grid 2 columnas:
  - **Riesgo**: número grande + risk-tag pill ("Alto" rojo / "Medio" ámbar / "Bajo" gris). Umbrales: ≥65 alto, ≥40 medio.
  - **Conexiones**: count de edges incidentes al root
  - **Relaciones marcadas** (full-width abajo): count de edges con flag + total en gris

### AI summary card
- Border-radius 14px, background var(--surface)
- Borde izquierdo de 3px con gradient `var(--c-person) → var(--c-contract)` (es el "branding" del análisis IA)
- Eyebrow mono "ANÁLISIS GENERADO" con dot pulsante (`pulse-dot` animation 1.6s)
- Body serif 15px line-height 1.55, text-wrap pretty
- En el repo real: backend call a `/api/ai/summary/{nodeId}` que llama a Claude API

### Red flags
- Tarjetas individuales con:
  - Badge de severidad arriba a la izquierda (high rojo, medium ámbar, low gris), font-size 10px uppercase mono, border de 1px del mismo color
  - Title 14.5px weight 500
  - Evidence serif 13.5px line-height 1.55 (italic-vibe ink-2)
  - Link de fuente abajo con `↗` + nombre, border-bottom dashed
- Animación de entrada slide-up con stagger 80ms

---

## 💬 Chatbot drawer

- Border-top 1px line; al fondo del canvas-col
- Colapsado: `max-height: 52px`. Expandido: `max-height: 360px`. Transición `var(--t-slow)`.
- Head clickeable: ícono + título serif "Pregúntale al perfil · NombreNodo"
- Chevron rota 180° cuando expande
- Body:
  - Mensajes (max-width 80%, user a la derecha en color ink/bg, AI a la izquierda en surface con border y font serif)
  - Estado typing: msg AI con `::after` caret blink
  - Chips de preguntas sugeridas (4 por idioma — ver `SUGGESTED_QUESTIONS` en data.js)
  - Input pill estilo search con botón send circular

**Comportamiento:** al enviar, se hace POST a `/api/ai/chat/{nodeId}` con el subgrafo + pregunta como contexto (RAG simple). Streaming si está disponible. En el prototipo está mockeado con respuestas determinísticas — ver `fakeAnswer` en `panels.jsx` para los patrones.

---

## ⚙️ Tweaks panel

Panel flotante bottom-right activable por el host (ya hay starter en otros repos). Para este proyecto, basta un botón "Tweaks" en el top bar que abre un panel con:
- **Tema:** Claro / Oscuro
- **Paleta:** 4 swatches curados ("Editorial" default, "Oceánica", "Ember", "Graphite") — cada uno define los 4 colores del grafo
- **Densidad:** Compacto / Regular / Amplio

Las paletas y densidades cambian CSS variables en `:root` o `data-theme`/`data-density` attribs. Persistencia en localStorage.

---

## 🌐 Bilingüe

Toggle ES/EN en el top bar. Todas las strings UI vienen de `window.I18N[lang]` (ver `data.js`). Los datos también: cada `flag` y `summary` tienen `{ es, en }`. Para el backend, el endpoint `/api/ai/summary/{nodeId}` debe aceptar un param `?lang=es|en` y pasárselo al prompt de Claude.

---

## 📡 Endpoints backend (ya existen) + nuevos

| Existente | Notas |
|---|---|
| `GET /api/search?q=` | Devuelve `SEARCH_INDEX` (id, name, type, subtitle, risk) |
| `GET /api/graph/:id?depth=2` | Devuelve `{ nodes: [...], edges: [...] }` con `risk_score` calculado |

| Nuevos a crear | Notas |
|---|---|
| `GET /api/ai/summary/:id?lang=es` | Resumen IA + red flags. Llama Claude con perfil completo del subgrafo. |
| `POST /api/ai/chat/:id` | Body `{ question, lang }`. RAG con subgrafo como contexto. |
| `GET /api/flags/:id` | Detector de patrones (puerta giratoria, conflicto familiar, etc.) sin IA — reglas duras. |

---

## 🧮 Detector de red flags (lógica, no IA)

Patrones a detectar en backend (`backend/controllers/flags_controller.py`):

1. **Puerta giratoria** (severidad high): persona pasa de cargo público a directorio/empresa que adjudicó contratos durante su gestión. Cooling period < 24 meses.
2. **Conflicto familiar** (high): root tiene edge `family_of` con persona que tiene `owns/signed` con empresa que tiene contrato con la entidad donde root es funcionario.
3. **Empresa fantasma** (high): empresa con `metadata.founded` y primer `awarded` con diferencia < 30 días, sin empleados declarados.
4. **Donación canalizada** (high): patrón `Empresa → ONG → Campaña` con vínculo familiar al receptor.
5. **Voto sin abstención** (high): persona vota en proceso legislativo que afecta empresa donde tiene vínculo familiar/owns directo.
6. **Patrimonio inconsistente** (medium): nodos `owns` no declarados en declaración patrimonial.
7. **Lobby tardío** (medium): audiencia declarada > 5 días hábiles después de ocurrida.

Cada flag retorna `{ id, severity, title: {es, en}, evidence: {es, en}, source: { label, url } }`.

---

## 🎨 Reglas que evitan que se vea "AI-generated"

- ❌ NO usar gradientes vistosos como fondo de cards
- ❌ NO usar emojis (excepto los del CLAUDE.md original si aparecen)
- ❌ NO usar iconografía decorativa de stock — usar SVG placeholders o nada
- ❌ NO Inter, Roboto, ni system-ui como fuente principal (usa IBM Plex Sans)
- ❌ NO border-left de color como único separador (overused)
- ❌ NO usar shadows fuertes — solo subtle on hover
- ❌ NO "data slop": estadísticas o números decorativos que no aportan información
- ✅ SÍ tipografía editorial (serif) para títulos importantes
- ✅ SÍ datos en mono
- ✅ SÍ paleta cálida desaturada en light, profunda en dark
- ✅ SÍ pulsación sutil en el nodo raíz
- ✅ SÍ vínculos marcados con dashed + animación de offset

---

## 📂 Estructura de archivos sugerida en el repo

```
frontend/src/
├── pages/
│   └── MapaPage.jsx            ← screen principal (replaces App.jsx layout)
├── components/
│   ├── topbar/
│   │   ├── Topbar.jsx
│   │   ├── SearchBar.jsx       ← autocomplete con debounce 300ms
│   │   ├── LangToggle.jsx
│   │   └── ThemeToggle.jsx
│   ├── canvas/
│   │   ├── CanvasTabs.jsx
│   │   ├── NeuralView.jsx      ← usa Vis.js con physics: false
│   │   ├── OrbitView.jsx       ← usa Vis.js con physics: false
│   │   ├── TimelineView.jsx
│   │   ├── TableView.jsx
│   │   ├── ZoomSlider.jsx
│   │   └── Legend.jsx
│   ├── panel/
│   │   ├── RightPanel.jsx
│   │   ├── ProfileHead.jsx
│   │   ├── AISummary.jsx
│   │   ├── FlagCard.jsx
│   │   └── StatCard.jsx
│   ├── chatbot/
│   │   ├── ChatbotDrawer.jsx
│   │   ├── ChatMessage.jsx
│   │   └── SuggestedChip.jsx
│   └── tweaks/
│       └── TweaksPanel.jsx
├── lib/
│   ├── layouts/
│   │   ├── radialTree.js       ← PORTAR exactamente desde reference/graph.jsx
│   │   └── layered.js          ← idem
│   ├── i18n.js                 ← strings ES/EN (desde reference/data.js)
│   └── api.js                  ← ya existe, extender con summary/chat
└── styles/
    ├── tokens.css              ← CSS variables (claro + oscuro)
    └── tailwind.config.js      ← colores y fuentes apuntando a tokens
```

---

## 📚 Archivos de referencia incluidos

```
reference/
├── Mapa de Poder.html      ← HTML root, estructura general y orden de scripts
├── styles.css              ← TODOS los tokens y estilos. Lee primero.
├── data.js                 ← Datos demo + diccionario i18n + paleta de paletas
├── app.jsx                 ← Shell, top bar, tabs, tweaks
├── graph.jsx               ← Layouts (radialTreeLayout, layeredLayout) + vistas SVG
├── views.jsx               ← TimelineView, TableView
├── panels.jsx              ← RightPanel, Chatbot
└── tweaks-panel.jsx        ← Starter del panel de tweaks (referencia)
```

Y `Mapa de Poder — Standalone.html` en la raíz: **abrílo en el navegador como referencia visual viva**.

---

## ✅ Checklist final antes de mostrar al usuario

- [ ] Top bar con search bar centrada, logo izq, toggles ES/EN y tema der
- [ ] Empty state con 3 case cards demo
- [ ] Al seleccionar caso: 4 tabs visibles, panel derecho aparece, chatbot drawer al fondo
- [ ] Red Neuronal: columnas verticales por depth, sin cruces innecesarios (barycenter ordering)
- [ ] Órbitas: anillos concéntricos, sectores con label `◆`, root al centro con pulse, arcos cruzados punteados visibles
- [ ] Porcentajes (`%`) visibles en aristas por default, no solo en hover
- [ ] Zoom slider lateral funciona (0.35 a 2.8x), display de % clickeable resetea
- [ ] Pan con drag funciona, salvo cuando clickeas un nodo
- [ ] Hover en nodo: ilumina sus aristas, atenúa el resto
- [ ] Profile head: stat cards con risk badge correcto según umbral
- [ ] AI summary con barra gradient izq y eyebrow con dot pulsante
- [ ] Red flag cards con badge de severidad, evidence en serif, link a fuente
- [ ] Chatbot: colapsa/expande, chips de preguntas sugeridas, mockeo de respuestas determinísticas hasta que el backend esté listo
- [ ] Toggle ES/EN cambia todo (UI strings, summary, flags, sugerencias chatbot)
- [ ] Toggle tema claro/oscuro funciona en todas las vistas
- [ ] Tweaks: 4 paletas + 3 densidades + tema
- [ ] Layout no se desborda en ningún tamaño (recordar `minmax(0, 1fr)` y `min-width: 0`)
