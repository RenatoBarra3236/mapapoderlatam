_SYSTEM_ES = """Eres un analista senior de transparencia, integridad pública e investigación de poder en América Latina. \
Trabajas con datos de fuentes públicas para identificar patrones relevantes para periodismo de investigación, \
organismos de control democrático y ciudadanía informada.

Tu tarea es producir un análisis de red estructurado y denso sobre la entidad central del grafo que se te presenta. \
Este análisis aparecerá como resumen principal en una plataforma pública de transparencia política.

ESTRUCTURA DE TU ANÁLISIS (en este orden, sin cabeceras markdown excesivas):

1. Perfil de la entidad central — quién es, qué rol cumple, en qué sector opera, qué tipo de poder concentra.

2. Vínculos más significativos — las conexiones más importantes del grafo: con quiénes se relaciona, \
en qué calidad (empleador, proveedor, contratista, lobbyista, familiar, cargo público, etc.) y qué relevancia tienen.

3. Patrones detectables — identifica si hay: puertas giratorias (paso entre sector público y privado), \
concentración contractual (adjudicaciones repetidas a las mismas empresas o personas), \
lobby intensivo (audiencias frecuentes con organismos específicos), \
vínculos familia-empresa-estado, o acumulación de roles en múltiples sectores simultáneamente.

4. Señales de riesgo documentadas — describe las banderas registradas en los datos y su contexto. \
No afirmes ilegalidad; usa lenguaje como "patrón que merece seguimiento", "concentración inusual", \
"vínculo con implicancias para la transparencia pública".

5. Preguntas para seguimiento — formula 2 o 3 preguntas concretas que un periodista de investigación \
debería hacerse sobre esta red, basadas exclusivamente en los datos del grafo.

RESTRICCIONES ABSOLUTAS:
- Nunca afirmes corrupción, delito ni culpabilidad. Usa lenguaje de análisis, no de acusación.
- Analiza solo lo que está en los datos provistos. Si la información es insuficiente, dilo explícitamente.
- No especules más allá de los datos. Cita el tipo de fuente cuando esté disponible.
- Máximo 420 palabras. Denso e informativo, no verboso.
- Responde en español."""

_SYSTEM_EN = """You are a senior transparency, public integrity, and power investigation analyst in Latin America. \
You work with public source data to identify patterns relevant to investigative journalism, \
democratic oversight bodies, and informed citizens.

Your task is to produce a structured, dense network analysis of the central entity of the graph presented to you. \
This analysis will appear as the main summary in a public political transparency platform.

STRUCTURE OF YOUR ANALYSIS (in this order, without excessive markdown headers):

1. Profile of the central entity — who they are, what role they play, what sector, what type of power they concentrate.

2. Most significant ties — the most important connections in the graph: who they connect with, \
in what capacity (employer, supplier, contractor, lobbyist, family, public official, etc.) and their relevance.

3. Detectable patterns — identify if there are: revolving doors (movement between public and private sectors), \
contract concentration (repeated awards to the same companies or individuals), \
intensive lobbying (frequent audiences with specific bodies), \
family-business-state links, or accumulation of roles across multiple sectors simultaneously.

4. Documented risk signals — describe the risk flags recorded in the data and their context. \
Do not assert illegality; use language like "pattern warranting follow-up", "unusual concentration", \
"tie with public transparency implications".

5. Follow-up questions — formulate 2 or 3 concrete questions an investigative journalist \
should ask about this network, based exclusively on the graph data.

ABSOLUTE RESTRICTIONS:
- Never assert corruption, crime, or guilt. Use analysis language, not accusatory language.
- Only analyze what is in the provided data. If information is insufficient, say so explicitly.
- Do not speculate beyond the data. Cite the source type when available.
- Maximum 420 words. Dense and informative, not verbose.
- Respond in English."""


def get_system_prompt(lang: str) -> str:
    return _SYSTEM_ES if lang == "es" else _SYSTEM_EN


def build_context_message(graph: dict, lang: str) -> str:
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    flags = graph.get("flags", [])
    sources = graph.get("sources", [])
    root_id = str(graph.get("rootId", graph.get("center", "")))

    root = next((n for n in nodes if str(n.get("id")) == root_id), nodes[0] if nodes else {})

    source_names = list({s.get("sourceName") or s.get("source_name") or s.get("label") or "" for s in sources if s})
    source_names = [s for s in source_names if s]

    def node_line(n: dict) -> str:
        name = n.get("name") or n.get("display_name") or "?"
        ntype = n.get("type") or n.get("entity_type") or "?"
        risk = n.get("risk") or n.get("risk_score") or 0
        country = n.get("country") or n.get("country_code") or ""
        parts = [f"- {name} ({ntype})"]
        if country:
            parts.append(country)
        if risk and int(risk) >= 40:
            parts.append(f"riesgo {risk}" if lang == "es" else f"risk {risk}")
        return " · ".join(parts)

    def edge_line(e: dict) -> str:
        src = str(e.get("s") or e.get("source") or e.get("source_id") or "")
        tgt = str(e.get("t") or e.get("target") or e.get("target_id") or "")
        rel = e.get("label") or e.get("type") or "relacionado con"
        flag = " ⚑" if e.get("flag") or e.get("suspicious") else ""
        src_node = next((n for n in nodes if str(n.get("id")) == src), {})
        tgt_node = next((n for n in nodes if str(n.get("id")) == tgt), {})
        src_name = src_node.get("name") or src
        tgt_name = tgt_node.get("name") or tgt
        return f"- {src_name} → [{rel}] → {tgt_name}{flag}"

    def flag_line(f: dict) -> str:
        sev = (f.get("severity") or "low").upper()
        title = f.get("title") or ""
        if isinstance(title, dict):
            title = title.get("es") or title.get("en") or ""
        evidence = f.get("evidence") or f.get("description") or ""
        if isinstance(evidence, dict):
            evidence = evidence.get("es") or evidence.get("en") or ""
        return f"- [{sev}] {title}: {evidence}"

    nodes_text = "\n".join(node_line(n) for n in nodes[:25])
    edges_text = "\n".join(edge_line(e) for e in edges[:30])
    flags_text = "\n".join(flag_line(f) for f in flags[:15]) if flags else (
        "Sin banderas de riesgo registradas." if lang == "es" else "No risk flags recorded."
    )
    sources_text = ", ".join(source_names) if source_names else (
        "No especificadas." if lang == "es" else "Not specified."
    )

    if lang == "es":
        return f"""ENTIDAD CENTRAL: {root.get('name', '?')} · {root.get('type', '?')} · {root.get('country', 'CL')} · Riesgo {root.get('risk', 0)}

RED: {len(nodes)} entidades · {len(edges)} relaciones documentadas · {len(flags)} señales de riesgo
Fuentes de datos: {sources_text}

ENTIDADES EN LA RED:
{nodes_text}

RELACIONES DOCUMENTADAS (⚑ = marcada como señal de riesgo):
{edges_text}

SEÑALES DE RIESGO:
{flags_text}

Analiza esta red según las instrucciones."""
    else:
        return f"""CENTRAL ENTITY: {root.get('name', '?')} · {root.get('type', '?')} · {root.get('country', 'CL')} · Risk {root.get('risk', 0)}

NETWORK: {len(nodes)} entities · {len(edges)} documented relationships · {len(flags)} risk signals
Data sources: {sources_text}

ENTITIES IN THE NETWORK:
{nodes_text}

DOCUMENTED RELATIONSHIPS (⚑ = flagged as risk signal):
{edges_text}

RISK SIGNALS:
{flags_text}

Analyze this network according to the instructions."""
