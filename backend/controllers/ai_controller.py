"""AI controllers — summary + flags generation, and chat over the subgraph."""
import json
import re
from data.demo_cases import get_case, format_subgraph_for_prompt
from utils.claude_client import ask_claude

# Process-wide cache for summary+flags. The demo cases are static, so once
# Claude generates a summary for a (case_id, lang) pair the answer is valid
# until the backend restarts. This avoids re-billing the Anthropic API every
# time a user toggles between cases during a demo. Bound the size to keep
# memory predictable if the case set grows.
_SUMMARY_CACHE: dict[str, dict] = {}
_SUMMARY_CACHE_MAX = 64


def clear_summary_cache():
    """For tests / admin endpoints."""
    _SUMMARY_CACHE.clear()


SUMMARY_SYSTEM_ES = """Eres un analista de transparencia y anticorrupción especializado en LATAM. Recibes el subgrafo de relaciones de un nodo (persona, empresa o contrato) extraído de fuentes públicas (registro civil, ChileCompra, declaraciones de patrimonio, lobby, etc.).

Tu trabajo es:
1. Redactar un resumen ejecutivo en lenguaje natural (3-5 oraciones, tono periodístico-investigativo, sin alarmismo) explicando qué pasa con este nodo, sus vínculos clave y por qué importan.
2. Detectar señales de riesgo (red flags) basadas únicamente en los datos del subgrafo. Cada flag debe tener evidencia concreta extraída del grafo.

Patrones a buscar (no inventes señales que no aparezcan en los datos):
- Puerta giratoria: paso de cargo público a empresa que adjudicó contratos durante su gestión, especialmente con cooling period < 24 meses.
- Conflicto familiar: vínculos `family_of` entre el nodo raíz y otro nodo con `owns`/`signed`/`donated_to` hacia una empresa o contrato relacionado.
- Empresa fantasma: empresa constituida días antes de adjudicar un contrato, sin historial ni empleados.
- Donación canalizada: patrón Empresa → ONG/fundación → Campaña con vínculo familiar al receptor.
- Voto sin abstención: persona que vota en proceso legislativo que afecta a empresa donde tiene vínculo familiar o directo.
- Patrimonio inconsistente: nodos `owns` no declarados en declaración patrimonial.
- Lobby tardío: audiencia de lobby declarada con > 5 días hábiles de retraso.

Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin ```), con esta forma exacta:

{
  "summary": "...",
  "flags": [
    {
      "id": "f1",
      "severity": "high" | "medium" | "low",
      "title": "Título corto de la señal",
      "evidence": "Evidencia concreta citando nombres y números del subgrafo",
      "source": { "label": "Fuente referencial (Ley, registro, etc.)", "url": "#" }
    }
  ]
}

Severidad:
- high: conflicto directo y verificable (puerta giratoria probada, conflicto familiar activo, empresa fantasma)
- medium: patrón sospechoso pero indirecto (patrimonio inconsistente, lobby tardío)
- low: contexto relevante pero no probadamente irregular

No agregues campos extra. No uses comillas tipográficas dentro del JSON."""

SUMMARY_SYSTEM_EN = """You are a transparency and anti-corruption analyst specialized in LATAM. You receive the subgraph of a node (person, company, or contract) extracted from public sources.

Your job:
1. Write an executive summary in natural language (3-5 sentences, investigative-journalism tone, no alarmism) explaining what's going on with this node, its key ties, and why they matter.
2. Detect red flags based ONLY on the subgraph data. Each flag must have concrete evidence from the graph.

Patterns to look for (do not invent signals not present in the data):
- Revolving door: public officer moving to a firm that was awarded contracts during their tenure, especially cooling period < 24 months.
- Family conflict: `family_of` ties between the root and another node with `owns`/`signed`/`donated_to` to a related firm or contract.
- Shell company: firm incorporated days before being awarded a contract, no track record or employees.
- Channeled donation: pattern Company → NGO → Campaign with family tie to the recipient.
- Vote without recusal: person voting on legislation affecting a firm where they have family/direct ties.
- Inconsistent wealth: `owns` nodes missing from declared wealth statements.
- Late lobbying: lobby meeting disclosed > 5 business days late.

Return ONLY a valid JSON object (no markdown, no ```), with this exact shape:

{
  "summary": "...",
  "flags": [
    {
      "id": "f1",
      "severity": "high" | "medium" | "low",
      "title": "Short flag title",
      "evidence": "Concrete evidence citing names and figures from the subgraph",
      "source": { "label": "Reference source (Law, registry, etc.)", "url": "#" }
    }
  ]
}

Severity:
- high: direct, verifiable conflict (proven revolving door, active family conflict, shell company)
- medium: suspicious but indirect pattern (inconsistent wealth, late lobbying)
- low: relevant context but not provably irregular

No extra fields. No typographic quotes inside the JSON."""


def _extract_json(text: str) -> dict:
    """Tolerant JSON extraction — strips markdown fences if Claude adds them."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```\s*$", "", cleaned)
    return json.loads(cleaned)


async def generate_summary_and_flags(case_id: str, lang: str = "es") -> dict:
    cache_key = f"{case_id}:{lang}"
    cached = _SUMMARY_CACHE.get(cache_key)
    if cached is not None:
        return cached

    case = get_case(case_id)
    if not case:
        raise ValueError(f"unknown case: {case_id}")

    subgraph_text = format_subgraph_for_prompt(case)
    system = SUMMARY_SYSTEM_ES if lang == "es" else SUMMARY_SYSTEM_EN
    user_prompt = (
        f"Subgrafo del caso `{case_id}`:\n\n{subgraph_text}\n\n"
        "Genera el JSON con el resumen y las red flags detectadas."
        if lang == "es"
        else f"Subgraph of case `{case_id}`:\n\n{subgraph_text}\n\n"
             "Generate the JSON with the summary and detected red flags."
    )

    raw = await ask_claude(prompt=user_prompt, system=system, max_tokens=2048)
    parsed = _extract_json(raw)

    # Normalize: ensure flags have ids
    for i, f in enumerate(parsed.get("flags", []), start=1):
        f.setdefault("id", f"f{i}")
        f.setdefault("source", {"label": "Subgrafo", "url": "#"})

    # Cache the successful result. Evict the oldest entry if we hit the bound.
    if len(_SUMMARY_CACHE) >= _SUMMARY_CACHE_MAX:
        _SUMMARY_CACHE.pop(next(iter(_SUMMARY_CACHE)))
    _SUMMARY_CACHE[cache_key] = parsed
    return parsed


COUNTRY_NAMES_ES = {"CL": "Chile", "MX": "México", "PE": "Perú", "CO": "Colombia"}
COUNTRY_NAMES_EN = {"CL": "Chile", "MX": "Mexico", "PE": "Peru", "CO": "Colombia"}
JURISDICTION_HINTS = {
    "CL": "Ley 20.880 (Probidad) y su modernización en tramitación (BCN id 1209272), Ley 19.886 (Compras Públicas), Ley 20.730 (Lobby), Servel, CPLT, SII, ChileCompra. Si el caso ocurre tras la entrada en vigencia de la modernización, mencionarla explícitamente.",
    "MX": "Ley General de Responsabilidades Administrativas, Ley Federal Anticorrupción, INE, SAT, CompraNet, Auditoría Superior de la Federación",
    "PE": "Ley 27815 (Código de Ética), Ley 28024 (Lobby), Ley 28094 (Partidos Políticos), ONPE, SUNAT, SEACE, Contraloría General",
    "CO": "Ley 1474 de 2011 (Estatuto Anticorrupción), Ley 1475/1996 (Partidos), Ley 5 de 1992 (Congreso), CNE, DIAN, SECOP II, Procuraduría",
}


def _chat_system_prompt(lang: str, country: str) -> str:
    country_name = (COUNTRY_NAMES_ES if lang == "es" else COUNTRY_NAMES_EN).get(country, country)
    jurisdiction = JURISDICTION_HINTS.get(country, "")
    if lang == "es":
        return f"""Eres un asistente de investigación periodística enfocado en transparencia y corrupción en LATAM. Respondes preguntas sobre un perfil específico de **{country_name}** usando ÚNICAMENTE el subgrafo provisto como contexto.

Reglas:
- Sé conciso (2-4 oraciones máximo). Tono profesional, sin alarmismo.
- Cita nombres concretos y números cuando sea posible.
- ANCLAJE DE JURISDICCIÓN: este caso es de **{country_name}**. Si necesitas referenciar normativa, registros o entidades regulatorias, usa SOLO las de {country_name} (ej.: {jurisdiction}). NO menciones leyes ni instituciones de otros países LATAM aunque suenen análogas.
- Si la pregunta excede lo que muestra el subgrafo, dilo explícitamente ("según los datos disponibles, no hay vínculo con X").
- NO inventes vínculos ni cifras. NO especules sobre intenciones.
- Si la pregunta es ambigua, contesta lo más relevante del subgrafo."""
    return f"""You are a research assistant focused on transparency and corruption in LATAM. You answer questions about a specific profile from **{country_name}** using ONLY the subgraph provided as context.

Rules:
- Be concise (2-4 sentences max). Professional tone, no alarmism.
- Cite specific names and figures when possible.
- JURISDICTION ANCHOR: this case is from **{country_name}**. When referencing laws, registries, or regulatory bodies, use ONLY those of {country_name} (e.g.: {jurisdiction}). DO NOT mention laws or institutions from other LATAM countries even if they sound analogous.
- If the question goes beyond the subgraph, say so explicitly ("based on the available data, there is no tie to X").
- DO NOT invent ties or figures. DO NOT speculate on intent.
- If the question is ambiguous, answer with the most relevant part of the subgraph."""


async def chat_about_case(case_id: str, question: str, lang: str = "es", history: list | None = None) -> str:
    case = get_case(case_id)
    if not case:
        raise ValueError(f"unknown case: {case_id}")

    subgraph_text = format_subgraph_for_prompt(case)
    nodes_by_id = {n["id"]: n for n in case["nodes"]}
    root_country = (nodes_by_id.get(case["rootId"]) or {}).get("country") or "CL"
    system_intro = _chat_system_prompt(lang, root_country)
    system_block = f"{system_intro}\n\nSUBGRAFO DEL CASO `{case_id}` (jurisdicción: {root_country}):\n\n{subgraph_text}"

    # Compose the user message; for now we don't replay history (lean for the demo).
    if history:
        prior = "\n\n".join(
            f"{'Usuario' if m.get('role') == 'user' else 'Asistente'}: {m.get('text', '')}"
            for m in history[-4:]
        )
        user_prompt = f"{prior}\n\nUsuario: {question}"
    else:
        user_prompt = question

    return await ask_claude(prompt=user_prompt, system=system_block, max_tokens=512)
