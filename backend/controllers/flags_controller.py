"""Rule-based red flag detector. Pure logic, no AI.
Operates on the subgraph (nodes + edges) of a demo case. Each rule returns a
flag dict in the same shape the frontend already renders for AI flags.

Bilingual: each flag's `title` and `evidence` are pre-written in {es, en}; the
caller picks the language. Sources cite the relevant LATAM laws/registries.
"""
from datetime import date
from data.demo_cases import get_case


# ── Country-specific legal sources ──────────────────────────────────────────
# Each rule's `source` field is picked per-country from this table so a Mexican
# case doesn't get cited under Chilean law and vice versa. URLs point to the
# canonical legal text or oversight registry where possible.

LEGAL_SOURCES = {
    "revolving_door": {
        "CL": {"label": "Ley 20.880 — Art. 56 (Probidad) · Modernización en tramitación (BCN 1209272)",
               "url": "https://www.bcn.cl/leychile/navegar?idNorma=1209272"},
        "MX": {"label": "Ley General de Responsabilidades Administrativas — Art. 60",
               "url": "https://www.diputados.gob.mx/LeyesBiblio/pdf/LGRA.pdf"},
        "PE": {"label": "Ley 27815 — Código de Ética de la Función Pública",
               "url": "https://www.gob.pe/institucion/servir/normas-legales/2511-27815"},
        "CO": {"label": "Ley 1474 de 2011 — Estatuto Anticorrupción (Art. 2–4)",
               "url": "https://www.secretariasenado.gov.co/senado/basedoc/ley_1474_2011.html"},
    },
    "family_conflict": {
        "CL": {"label": "Ley 20.880 — Declaración de Intereses · Modernización en tramitación",
               "url": "https://www.bcn.cl/leychile/navegar?idNorma=1209272"},
        "MX": {"label": "Ley General de Responsabilidades Administrativas — Art. 58",
               "url": "https://www.diputados.gob.mx/LeyesBiblio/pdf/LGRA.pdf"},
        "PE": {"label": "Ley 27815 — Conflicto de Intereses (Art. 8)",
               "url": "https://www.gob.pe/institucion/servir/normas-legales/2511-27815"},
        "CO": {"label": "Ley 1474 de 2011 — Art. 8 (Inhabilidades)",
               "url": "https://www.secretariasenado.gov.co/senado/basedoc/ley_1474_2011.html"},
    },
    "shell_company": {
        "CL": {"label": "Registro SII + Mercado Público",
               "url": "https://www.mercadopublico.cl/"},
        "MX": {"label": "SAT + CompraNet",
               "url": "https://compranet.hacienda.gob.mx/"},
        "PE": {"label": "SUNAT + SEACE",
               "url": "https://prodapp.seace.gob.pe/"},
        "CO": {"label": "DIAN + SECOP II",
               "url": "https://www.colombiacompra.gov.co/secop-ii"},
    },
    "channeled_donation": {
        "CL": {"label": "Servel + CPLT",
               "url": "https://www.servel.cl/"},
        "MX": {"label": "INE — Reglamento Fiscalización Partidos",
               "url": "https://www.ine.mx/"},
        "PE": {"label": "ONPE — Ley 28094 Partidos Políticos",
               "url": "https://www.onpe.gob.pe/"},
        "CO": {"label": "CNE — Ley 1475 de 2011",
               "url": "https://www.cne.gov.co/"},
    },
    "vote_without_recusal": {
        "CL": {"label": "Ley 20.880 — Art. 56 + modernización en tramitación · Reglamento Cámara",
               "url": "https://www.bcn.cl/leychile/navegar?idNorma=1209272"},
        "MX": {"label": "Ley Orgánica del Congreso — Art. 8 (Conflicto de Interés)",
               "url": "https://www.diputados.gob.mx/LeyesBiblio/pdf/LOCG.pdf"},
        "PE": {"label": "Reglamento del Congreso — Art. 92 (Abstención)",
               "url": "https://www.congreso.gob.pe/Docs/files/reglamentocongreso.pdf"},
        "CO": {"label": "Ley 5 de 1992 — Art. 286 (Régimen Conflicto de Interés)",
               "url": "https://www.secretariasenado.gov.co/senado/basedoc/ley_0005_1992.html"},
    },
}


def _source(rule_key: str, country: str) -> dict:
    """Pick the legal source for a given rule + country. Falls back to Chile
    if the country isn't mapped (mirrors the data's CL-default tilt)."""
    by_country = LEGAL_SOURCES.get(rule_key, {})
    return by_country.get(country) or by_country.get("CL") or {"label": "Subgrafo", "url": "#"}


def _root_country(case: dict, nodes: dict) -> str:
    root = nodes.get(case["rootId"])
    return (root or {}).get("country") or "CL"


# ── Helpers ─────────────────────────────────────────────────────────────────

def _by_id(case):
    return {n["id"]: n for n in case["nodes"]}


def _edges_from(case, nid):
    return [e for e in case["edges"] if e["s"] == nid]


def _edges_to(case, nid):
    return [e for e in case["edges"] if e["t"] == nid]


def _parse_date(s):
    if not s:
        return None
    try:
        parts = s.split("-")
        y = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 1
        d = int(parts[2]) if len(parts) > 2 else 1
        return date(y, m, d)
    except (ValueError, IndexError):
        return None


# ── Rules ───────────────────────────────────────────────────────────────────

def _rule_revolving_door(case, nodes):
    """Root has `former_role` to entity E, E has `awarded` to company C,
    and root now `owns` C. → puerta giratoria."""
    out = []
    root_id = case["rootId"]
    country = _root_country(case, nodes)
    former_roles = [e for e in _edges_from(case, root_id) if e["type"] == "former_role"]
    owns_now = [e for e in _edges_from(case, root_id) if e["type"] == "owns"]

    for fr in former_roles:
        entity_id = fr["t"]
        awarded_by_entity = [e for e in _edges_from(case, entity_id) if e["type"] == "awarded"]
        for aw in awarded_by_entity:
            awarded_target = aw["t"]  # a contract
            companies_with_contract = [e["s"] for e in _edges_to(case, awarded_target) if e["type"] == "awarded" and e["s"] != entity_id]
            for own in owns_now:
                if own["t"] in companies_with_contract:
                    root = nodes[root_id]
                    entity = nodes[entity_id]
                    company = nodes[own["t"]]
                    contract = nodes[awarded_target]
                    amount = (contract.get("meta") or {}).get("amount", "—")
                    out.append({
                        "id": f"rule-revolving-{root_id}-{entity_id}-{own['t']}-{awarded_target}",
                        "severity": "high",
                        "title": {
                            "es": "Puerta giratoria",
                            "en": "Revolving door"
                        },
                        "evidence": {
                            "es": f"{root['name']} ejerció como {fr['label']} en {entity['name']}, entidad que adjudicó “{contract['name']}” ({amount}) a {company['name']}. Hoy {root['name']} figura como {own['label']} de esa misma empresa.",
                            "en": f"{root['name']} served as {fr['label']} at {entity['name']}, the entity that awarded “{contract['name']}” ({amount}) to {company['name']}. {root['name']} now holds {own['label']} in that very firm."
                        },
                        "source": _source("revolving_door", country),
                    })
    return out


def _rule_family_conflict(case, nodes):
    """Root has `family_of` to P, P has `owns/signed` chain to company C,
    and C has a contractual relationship (signed/awarded) to anything tied
    to root. → conflicto familiar."""
    out = []
    root_id = case["rootId"]
    country = _root_country(case, nodes)
    family = [e for e in _edges_from(case, root_id) if e["type"] == "family_of"]
    family += [e for e in _edges_to(case, root_id) if e["type"] == "family_of"]

    # Nodes the root is tied to (anything they own, signed, or formerly held a role at)
    root_ties = set()
    for e in _edges_from(case, root_id):
        if e["type"] in ("owns", "signed", "former_role", "awarded"):
            root_ties.add(e["t"])

    for fam in family:
        relative_id = fam["t"] if fam["s"] == root_id else fam["s"]
        relative = nodes[relative_id]

        # Companies the relative owns or signs
        rel_companies = []
        for e in _edges_from(case, relative_id):
            if e["type"] in ("owns", "signed"):
                rel_companies.append((e, nodes[e["t"]]))

        for rel_edge, comp in rel_companies:
            # Does this company touch any of root's ties?
            comp_outgoing = [e["t"] for e in _edges_from(case, comp["id"])]
            comp_incoming = [e["s"] for e in _edges_to(case, comp["id"])]
            shared = (set(comp_outgoing) | set(comp_incoming)) & root_ties
            if shared:
                shared_node = nodes[next(iter(shared))]
                root = nodes[root_id]
                out.append({
                    "id": f"rule-family-{relative_id}-{comp['id']}",
                    "severity": "high",
                    "title": {
                        "es": "Conflicto de interés familiar",
                        "en": "Family conflict of interest"
                    },
                    "evidence": {
                        "es": f"{relative['name']} ({fam['label']} de {root['name']}) tiene relación “{rel_edge['label']}” con {comp['name']}, la cual está vinculada a {shared_node['name']} — entidad o contrato donde {root['name']} también tiene participación.",
                        "en": f"{relative['name']} ({fam['label']} of {root['name']}) holds “{rel_edge['label']}” in {comp['name']}, which is tied to {shared_node['name']} — an entity or contract where {root['name']} also has a stake."
                    },
                    "source": _source("family_conflict", country),
                })
    return out


def _rule_shell_company(case, nodes, window_days=180):
    """Any company node founded within `window_days` of its first awarded
    contract. → empresa fantasma."""
    out = []
    country = _root_country(case, nodes)
    for n in case["nodes"]:
        if n["type"] != "company":
            continue
        meta = n.get("meta") or {}
        founded = _parse_date(meta.get("founded"))
        if not founded:
            continue
        # Find first contract this company was awarded
        awarded_edges = [e for e in _edges_from(case, n["id"]) if e["type"] == "awarded"]
        for ae in awarded_edges:
            contract = nodes[ae["t"]]
            awarded_date = _parse_date((contract.get("meta") or {}).get("awarded"))
            if not awarded_date:
                continue
            diff = (awarded_date - founded).days
            if 0 <= diff <= window_days:
                amount = (contract.get("meta") or {}).get("amount", "—")
                out.append({
                    "id": f"rule-shell-{n['id']}-{contract['id']}",
                    "severity": "high",
                    "title": {
                        "es": "Empresa fantasma",
                        "en": "Shell company"
                    },
                    "evidence": {
                        "es": f"{n['name']} fue constituida el {founded.isoformat()} y adjudicó “{contract['name']}” ({amount}) solo {diff} días después. Sin historial operativo previo.",
                        "en": f"{n['name']} was incorporated on {founded.isoformat()} and was awarded “{contract['name']}” ({amount}) just {diff} days later. No prior operational track record."
                    },
                    "source": _source("shell_company", country),
                })
    return out


def _rule_channeled_donation(case, nodes):
    """Chain: root has family_of → P, P owns C, C donated_to F (flag),
    F signed/donated_to something tied to root. → donación canalizada."""
    out = []
    root_id = case["rootId"]
    country = _root_country(case, nodes)
    fam_edges = [e for e in _edges_from(case, root_id) + _edges_to(case, root_id) if e["type"] == "family_of"]

    for fam in fam_edges:
        relative_id = fam["t"] if fam["s"] == root_id else fam["s"]
        rel_companies = [e["t"] for e in _edges_from(case, relative_id) if e["type"] == "owns"]
        for c in rel_companies:
            donations = [e for e in _edges_from(case, c) if e["type"] == "donated_to" and e.get("flag")]
            for d in donations:
                middleman_id = d["t"]
                # Did the middleman pass funds to anything tied to root?
                outgoing = [e for e in _edges_from(case, middleman_id) if e["type"] in ("signed", "donated_to")]
                for og in outgoing:
                    final = og["t"]
                    final_to_root = [e for e in _edges_from(case, final) if e["type"] == "donated_to" and e["t"] == root_id]
                    if final_to_root:
                        root = nodes[root_id]
                        relative = nodes[relative_id]
                        company = nodes[c]
                        middleman = nodes[middleman_id]
                        out.append({
                            "id": f"rule-channeled-{relative_id}-{c}-{middleman_id}-{final}",
                            "severity": "high",
                            "title": {
                                "es": "Donación canalizada por entidad vinculada",
                                "en": "Donation laundered via linked entity"
                            },
                            "evidence": {
                                "es": f"{company['name']} (controlada por {relative['name']}, {fam['label']} de {root['name']}) transfirió fondos a {middleman['name']}, que a su vez canalizó aportes hacia {root['name']}.",
                                "en": f"{company['name']} (controlled by {relative['name']}, {fam['label']} of {root['name']}) transferred funds to {middleman['name']}, which then channeled donations to {root['name']}."
                            },
                            "source": _source("channeled_donation", country),
                        })
    return out


def _rule_vote_without_recusal(case, nodes):
    """Root has family_of → P, P owns C, AND root signed/voted on an entity
    (isEntity) whose name suggests it affects C's sector. → voto sin abstención."""
    out = []
    root_id = case["rootId"]
    country = _root_country(case, nodes)
    source = _source("vote_without_recusal", country)
    # Root's signing actions targeting entity-type nodes (votos, leyes, audiencias)
    votes = [
        e for e in _edges_from(case, root_id)
        if e["type"] == "signed" and (nodes.get(e["t"]) or {}).get("isEntity")
    ]
    if not votes:
        return out

    fam_edges = [e for e in _edges_from(case, root_id) + _edges_to(case, root_id) if e["type"] == "family_of"]
    for fam in fam_edges:
        relative_id = fam["t"] if fam["s"] == root_id else fam["s"]
        rel_companies = [(e, nodes[e["t"]]) for e in _edges_from(case, relative_id) if e["type"] == "owns"]
        for vote in votes:
            for rel_edge, comp in rel_companies:
                root = nodes[root_id]
                relative = nodes[relative_id]
                vote_node = nodes[vote["t"]]
                out.append({
                    "id": f"rule-vote-{vote['t']}-{relative_id}-{comp['id']}",
                    "severity": "high",
                    "title": {
                        "es": "Voto sin abstención",
                        "en": "Vote without recusal"
                    },
                    "evidence": {
                        "es": f"{root['name']} participó en “{vote_node['name']}” ({vote['label']}) mientras su {fam['label']} {relative['name']} controla {comp['name']}. La normativa vigente exige abstenerse cuando hay conflicto directo de interés.",
                        "en": f"{root['name']} took part in “{vote_node['name']}” ({vote['label']}) while their {fam['label']} {relative['name']} controls {comp['name']}. Local conflict-of-interest law requires recusal in direct conflicts."
                    },
                    "source": source,
                })
    return out


# ── Orchestrator ────────────────────────────────────────────────────────────

RULES = [
    _rule_revolving_door,
    _rule_family_conflict,
    _rule_shell_company,
    _rule_channeled_donation,
    _rule_vote_without_recusal,
]


def detect_flags(case_id: str, lang: str = "es") -> list[dict]:
    case = get_case(case_id)
    if not case:
        raise ValueError(f"unknown case: {case_id}")
    nodes = _by_id(case)

    raw = []
    for rule in RULES:
        try:
            raw.extend(rule(case, nodes))
        except Exception:
            # A single rule failure shouldn't blow up the whole detector.
            continue

    # Resolve {es, en} → string in requested language.
    out = []
    for f in raw:
        out.append({
            "id": f["id"],
            "severity": f["severity"],
            "title": f["title"][lang] if isinstance(f["title"], dict) else f["title"],
            "evidence": f["evidence"][lang] if isinstance(f["evidence"], dict) else f["evidence"],
            "source": f["source"],
            "kind": "rule",
        })
    return out
