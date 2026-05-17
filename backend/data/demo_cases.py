"""Demo cases — fictional LATAM corruption scenarios. Mirrors frontend/src/lib/demoData.js.
Only the fields the AI needs (nodes, edges, rootId) are stored here. The frontend
keeps the timeline + visual coordinates.
"""

DEMO_CASES = {
    "fuentes": {
        "id": "fuentes",
        "rootId": 1,
        "nodes": [
            {"id": 1, "type": "person", "name": "Carlos Fuentes Saavedra", "subtitle": "Ex-Subsecretario de Obras Públicas", "country": "CL", "risk": 78,
             "meta": {"rut": "8.234.567-9", "born": "1962", "education": "Ing. Civil, U. de Chile", "currentRole": "Director — Constructora Los Andes SpA (2024–)"}},
            {"id": 2, "type": "company", "name": "Constructora Los Andes SpA", "country": "CL", "risk": 64,
             "meta": {"founded": "2018", "sector": "Construcción / Infraestructura", "revenue": "≈ CLP 42.000M (2023)"}},
            {"id": 3, "type": "contract", "name": "Concesión Ruta 68 — Tramo 4", "country": "CL", "risk": 71,
             "meta": {"amount": "CLP 184.500M", "awarded": "2022-09-14", "duration": "12 años"}},
            {"id": 4, "type": "person", "name": "Ministerio de Obras Públicas", "subtitle": "Entidad licitante", "country": "CL", "risk": 0, "isEntity": True},
            {"id": 5, "type": "person", "name": "Andrea Fuentes Lyon", "subtitle": "Hija / Abogada", "country": "CL", "risk": 38,
             "meta": {"rut": "19.876.123-2", "role": "Socia, Lyon & Asociados"}},
            {"id": 6, "type": "company", "name": "Lyon & Asociados", "country": "CL", "risk": 41,
             "meta": {"sector": "Estudio jurídico", "clients": "Constructora Los Andes (2021–)"}},
            {"id": 7, "type": "company", "name": "Inversiones Cordillera Ltda.", "country": "CL", "risk": 52,
             "meta": {"founded": "2015", "sector": "Holding familiar"}},
            {"id": 8, "type": "contract", "name": "Mantención Hospital Regional Talca", "country": "CL", "risk": 44,
             "meta": {"amount": "CLP 12.300M", "awarded": "2020-03-02"}},
        ],
        "edges": [
            {"s": 1, "t": 4, "type": "former_role", "label": "Subsecretario (2018–2022)", "weight": 1},
            {"s": 4, "t": 3, "type": "awarded", "label": "Adjudicó licitación", "weight": 1},
            {"s": 2, "t": 3, "type": "awarded", "label": "Adjudicataria", "weight": 1},
            {"s": 1, "t": 2, "type": "owns", "label": "Director (2024–) · 18% participación", "weight": 0.18, "flag": True},
            {"s": 1, "t": 5, "type": "family_of", "label": "Padre", "weight": 1},
            {"s": 5, "t": 6, "type": "owns", "label": "Socia 50%", "weight": 0.5},
            {"s": 6, "t": 2, "type": "signed", "label": "Asesora legal desde 2021", "weight": 1, "flag": True},
            {"s": 1, "t": 7, "type": "owns", "label": "Beneficiario final 70%", "weight": 0.7},
            {"s": 2, "t": 8, "type": "awarded", "label": "Contrato menor", "weight": 1},
        ],
    },
    "errazuriz": {
        "id": "errazuriz",
        "rootId": 11,
        "nodes": [
            {"id": 11, "type": "person", "name": "María José Errázuriz Pinto", "subtitle": "Diputada — Comisión de Minería", "country": "CL", "risk": 64,
             "meta": {"rut": "13.456.789-0", "born": "1978", "party": "Coalición Centro", "terms": "2018–presente"}},
            {"id": 12, "type": "person", "name": "Tomás Errázuriz P.", "subtitle": "Hermano / Empresario", "country": "CL", "risk": 47,
             "meta": {"rut": "12.987.654-3", "role": "CEO MineraPacífico"}},
            {"id": 13, "type": "company", "name": "MineraPacífico Holdings", "country": "CL", "risk": 58,
             "meta": {"sector": "Minería — Cobre", "revenue": "USD 1.2B (2023)"}},
            {"id": 14, "type": "company", "name": "Fundación Horizonte Verde", "country": "CL", "risk": 33,
             "meta": {"sector": "ONG — Causas ambientales (de fachada según querella)"}},
            {"id": 15, "type": "contract", "name": "Audiencia de lobby #4421", "country": "CL", "risk": 49,
             "meta": {"date": "2023-06-12", "topic": "Royalty minero"}},
            {"id": 16, "type": "contract", "name": "Donación campaña 2021", "country": "CL", "risk": 51,
             "meta": {"amount": "CLP 28M", "source": "MineraPacífico via fundación"}},
            {"id": 17, "type": "company", "name": "Ley Royalty Minero — Voto", "country": "CL", "risk": 0, "isEntity": True},
        ],
        "edges": [
            {"s": 11, "t": 12, "type": "family_of", "label": "Hermana", "weight": 1},
            {"s": 12, "t": 13, "type": "owns", "label": "CEO + 12% accionista", "weight": 0.12},
            {"s": 13, "t": 14, "type": "donated_to", "label": "Aporte CLP 45M (2020–2023)", "weight": 1, "flag": True},
            {"s": 14, "t": 16, "type": "signed", "label": "Canalizó donación de campaña", "weight": 1, "flag": True},
            {"s": 16, "t": 11, "type": "donated_to", "label": "Recibió aporte CLP 28M", "weight": 1},
            {"s": 13, "t": 15, "type": "signed", "label": "Solicitó audiencia", "weight": 1},
            {"s": 15, "t": 11, "type": "signed", "label": "Recibió audiencia (Comisión Minería)", "weight": 1},
            {"s": 11, "t": 17, "type": "signed", "label": "Votó en contra del royalty (2023)", "weight": 1, "flag": True},
        ],
    },
    "losandes": {
        "id": "losandes",
        "rootId": 21,
        "nodes": [
            {"id": 21, "type": "company", "name": "Servicios Patagonia Express SpA", "country": "CL", "risk": 82,
             "meta": {"rut": "76.543.210-K", "founded": "2023-11-08", "sector": "Logística / Transporte"}},
            {"id": 22, "type": "contract", "name": "Suministro emergencia incendios — CONAF", "country": "CL", "risk": 76,
             "meta": {"amount": "CLP 7.800M", "awarded": "2024-02-19", "duration": "8 meses"}},
            {"id": 23, "type": "person", "name": "Roberto Mansilla Vargas", "subtitle": "Representante legal", "country": "CL", "risk": 54,
             "meta": {"rut": "16.234.567-1", "role": "Único socio declarado"}},
            {"id": 24, "type": "company", "name": "CONAF", "country": "CL", "risk": 0, "isEntity": True},
            {"id": 25, "type": "person", "name": "Pamela Sotomayor R.", "subtitle": "Jefa Adquisiciones CONAF", "country": "CL", "risk": 58,
             "meta": {"rut": "14.567.890-2"}},
            {"id": 26, "type": "company", "name": "GrupoMansilla Ltda.", "country": "CL", "risk": 47,
             "meta": {"sector": "Holding (3 empresas)"}},
            {"id": 27, "type": "company", "name": "Logística Austral S.A. (relacionada)", "country": "CL", "risk": 49,
             "meta": {"sector": "Transporte", "history": "Adjudicó contratos CONAF 2019–2022"}},
        ],
        "edges": [
            {"s": 23, "t": 21, "type": "owns", "label": "100% socio único", "weight": 1},
            {"s": 21, "t": 22, "type": "awarded", "label": "Adjudicataria — 11 días post-constitución", "weight": 1, "flag": True},
            {"s": 24, "t": 22, "type": "awarded", "label": "Adjudicó por trato directo", "weight": 1, "flag": True},
            {"s": 25, "t": 22, "type": "signed", "label": "Firmó adjudicación", "weight": 1},
            {"s": 23, "t": 26, "type": "owns", "label": "Beneficiario final", "weight": 1},
            {"s": 26, "t": 27, "type": "owns", "label": "Controla 80%", "weight": 0.8},
            {"s": 25, "t": 23, "type": "family_of", "label": "Ex-cuñados", "weight": 1, "flag": True},
        ],
    },
}


def get_case(case_id: str):
    return DEMO_CASES.get(case_id)


def format_subgraph_for_prompt(case: dict) -> str:
    """Renders the subgraph as compact human-readable text for Claude's context."""
    node_by_id = {n["id"]: n for n in case["nodes"]}
    root = node_by_id[case["rootId"]]

    lines = []
    lines.append(f"NODO RAÍZ: {root['name']} ({root.get('subtitle', '')})")
    lines.append(f"  tipo: {root['type']} · país: {root.get('country', '?')} · riesgo: {root.get('risk', 0)}")
    if root.get("meta"):
        for k, v in root["meta"].items():
            lines.append(f"  {k}: {v}")

    lines.append("\nOTROS NODOS:")
    for n in case["nodes"]:
        if n["id"] == case["rootId"]:
            continue
        sub = n.get("subtitle", "")
        meta = "; ".join(f"{k}: {v}" for k, v in (n.get("meta") or {}).items())
        lines.append(f"- [{n['id']}] {n['name']} ({n['type']}) {sub}".rstrip())
        if meta:
            lines.append(f"    {meta}")

    lines.append("\nRELACIONES:")
    for e in case["edges"]:
        s = node_by_id[e["s"]]["name"]
        t = node_by_id[e["t"]]["name"]
        flag = " ⚠ MARCADA" if e.get("flag") else ""
        lines.append(f"- {s} → [{e['type']}] {e.get('label', '')} → {t}{flag}")

    return "\n".join(lines)
