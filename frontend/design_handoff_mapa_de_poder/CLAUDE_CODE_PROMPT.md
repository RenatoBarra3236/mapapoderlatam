# Prompt para iniciar con Claude Code

Copia y pega EXACTAMENTE esto en tu primer mensaje a Claude Code después de copiar la carpeta `design_handoff_mapa_de_poder/` dentro de tu repo.

---

## Mensaje #1 (apertura)

```
Lee con detenimiento estos archivos antes de cualquier acción:

1. frontend/design_handoff_mapa_de_poder/README.md (todo)
2. frontend/design_handoff_mapa_de_poder/reference/styles.css (todos los tokens)
3. frontend/design_handoff_mapa_de_poder/reference/data.js (estructura de datos)
4. CLAUDE.md (contexto del proyecto)

Vas a implementar el diseño de Mapa de Poder LATAM en este repo (FastAPI + React + Vite + Tailwind + Vis.js). El README contiene tokens, algoritmos y comportamientos exactos. El archivo "Mapa de Poder — Standalone.html" en la carpeta del handoff es la referencia visual viva — ábrelo en tu navegador en otra pestaña.

Reglas no negociables:
- Los archivos en reference/ son la fuente de verdad, NO los copies tal cual (están en JSX con Babel inline, hay que traducirlos al stack del repo)
- NO agregues secciones, copy, features ni iconografía decorativa que no esté en el README
- NO reemplaces los algoritmos radialTreeLayout ni layeredLayout — pórtalos JS → JS, son código puro
- NO uses el force-directed de Vis.js — usa physics: false y pásale las posiciones calculadas por mis algoritmos. Eso es lo que nos diferencia de DeQuiénes.cl.
- Implementa una vista a la vez en este orden: shell → búsqueda → Red Neuronal → panel derecho → Órbitas → Timeline → Tabla → chatbot → tweaks. Para después de cada vista y muéstrame el resultado.
- Si algo del README es ambiguo, pregunta antes de improvisar.

Confirma que leíste todo y dime tu plan paso a paso antes de tocar código.
```

---

## Mensaje #2 (después de cada vista terminada)

```
Compara visualmente lo que acabas de hacer contra el HTML standalone que tengo abierto en otra pestaña. ¿Hay diferencias en spacing, color, tipografía, comportamiento de hover, o algo más? Si las hay, lístalas y arréglalas. Si no, sigue con la siguiente vista del orden del README.
```

---

## Mensaje útil cuando algo se ve raro

```
Esto se ve distinto al standalone. Específicamente [X]. Lee de nuevo la sección del README correspondiente, y mira reference/[archivo] para ver cómo lo hice yo. Ajusta sin agregar nada extra.
```

---

## Si Claude Code intenta usar otra librería de grafos (D3, react-flow, etc.)

```
NO. El proyecto usa Vis.js (ver CLAUDE.md). Mantén Vis.js. Solo necesitas:
1. Configurar Vis.js con physics: false
2. Pasarle los nodos con x, y precomputados por mi algoritmo (radialTreeLayout o layeredLayout)
3. Las edges como están en los datos
4. Custom rendering opcional para las aristas chord/flag con el dashed-array que dice el README

No me cambies la librería.
```

---

## Si Claude Code propone añadir features

```
Por ahora NO. Vamos a entregar el diseño exacto del README primero. Features extras los discutimos en una segunda iteración.
```
