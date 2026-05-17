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
            # Expansion
            {"id": 9, "type": "person", "name": "Patricia Saavedra Donoso", "subtitle": "Cónyuge / Empresaria", "country": "CL", "risk": 44,
             "meta": {"rut": "9.123.456-7", "role": "Socia 30% Inversiones Cordillera"}},
            {"id": 10, "type": "contract", "name": "Concesión Aeropuerto Carriel Sur", "country": "CL", "risk": 68,
             "meta": {"amount": "CLP 96.200M", "awarded": "2021-11-08", "duration": "10 años"}},
            {"id": 11, "type": "company", "name": "Constructora del Sur Ltda.", "country": "CL", "risk": 47,
             "meta": {"founded": "2020", "sector": "Construcción regional", "parent": "Constructora Los Andes (60%)"}},
            {"id": 12, "type": "contract", "name": "Concesión Ruta 5 Tramo Norte", "country": "CL", "risk": 59,
             "meta": {"amount": "CLP 142.800M", "awarded": "2022-04-22", "duration": "10 años"}},
            {"id": 13, "type": "contract", "name": "Audiencia Lobby #2298", "country": "CL", "risk": 36,
             "meta": {"date": "2020-06-12", "topic": "Plan de Concesiones Viales 2020–2025"}},
            {"id": 14, "type": "company", "name": "Cordillera Capital S.A.", "country": "CL", "risk": 49,
             "meta": {"founded": "2019", "sector": "Holding financiero", "parent": "Inversiones Cordillera (85%)"}},
            {"id": 15, "type": "company", "name": "Fundación Andes Sustentable", "country": "CL", "risk": 34,
             "meta": {"sector": "ONG ambiental", "funding": "Aportes Inversiones Cordillera 2020–2023"}},
            {"id": 16, "type": "company", "name": "Servicios Andinos SpA", "country": "CL", "risk": 42,
             "meta": {"founded": "2019", "sector": "Servicios técnicos / construcción", "owner": "Patricia Saavedra"}},
            {"id": 17, "type": "contract", "name": "Mantenimiento Vialidad Región VIII", "country": "CL", "risk": 56,
             "meta": {"amount": "CLP 28.700M", "awarded": "2021-03-15", "duration": "5 años"}},
            {"id": 18, "type": "person", "name": "Eduardo Larraín Hidalgo", "subtitle": "Ex-Director Vialidad MOP / Gerente Constructora", "country": "CL", "risk": 51,
             "meta": {"rut": "11.345.678-K", "role": "Director Vialidad 2018–2022 → Gerente Constructora 2023"}},
        ],
        "edges": [
            # Originales
            {"s": 1, "t": 4, "type": "former_role", "label": "Subsecretario (2018–2022)", "weight": 1},
            {"s": 4, "t": 3, "type": "awarded", "label": "Adjudicó licitación", "weight": 1},
            {"s": 2, "t": 3, "type": "awarded", "label": "Adjudicataria", "weight": 1},
            {"s": 1, "t": 2, "type": "owns", "label": "Director (2024–) · 18% participación", "weight": 0.18, "flag": True},
            {"s": 1, "t": 5, "type": "family_of", "label": "Padre", "weight": 1},
            {"s": 5, "t": 6, "type": "owns", "label": "Socia 50%", "weight": 0.5},
            {"s": 6, "t": 2, "type": "signed", "label": "Asesora legal desde 2021", "weight": 1, "flag": True},
            {"s": 1, "t": 7, "type": "owns", "label": "Beneficiario final 70%", "weight": 0.7},
            {"s": 2, "t": 8, "type": "awarded", "label": "Contrato menor", "weight": 1},
            # Cónyuge + holding familiar
            {"s": 1, "t": 9, "type": "family_of", "label": "Esposa", "weight": 1},
            {"s": 9, "t": 7, "type": "owns", "label": "Socia 30%", "weight": 0.3},
            # Más contratos MOP → Constructora
            {"s": 4, "t": 10, "type": "awarded", "label": "Adjudicó concesión", "weight": 1},
            {"s": 2, "t": 10, "type": "awarded", "label": "Adjudicataria Aeropuerto Carriel Sur", "weight": 1, "flag": True},
            # Subsidiaria de Constructora
            {"s": 2, "t": 11, "type": "owns", "label": "Matriz · 60%", "weight": 0.6},
            {"s": 4, "t": 12, "type": "awarded", "label": "Adjudicó concesión", "weight": 1},
            {"s": 11, "t": 12, "type": "awarded", "label": "Adjudicataria · vía empresa relacionada", "weight": 1, "flag": True},
            # Audiencia de lobby durante el mandato
            {"s": 2, "t": 13, "type": "signed", "label": "Solicitó audiencia (Constructora Los Andes)", "weight": 1},
            {"s": 13, "t": 1, "type": "signed", "label": "Concedida durante gestión MOP", "weight": 1, "flag": True},
            # Inversiones Cordillera → subsidiarias + donaciones
            {"s": 7, "t": 14, "type": "owns", "label": "Matriz · 85%", "weight": 0.85},
            {"s": 7, "t": 15, "type": "donated_to", "label": "Aportes CLP 18M (2020–2023)", "weight": 1},
            {"s": 15, "t": 2, "type": "signed", "label": "Campaña PR ambiental para constructora", "weight": 1, "flag": True},
            # Empresa de la esposa también adjudicada por MOP
            {"s": 9, "t": 16, "type": "owns", "label": "Socia 70%", "weight": 0.7},
            {"s": 4, "t": 17, "type": "awarded", "label": "Adjudicó contrato", "weight": 1},
            {"s": 16, "t": 17, "type": "awarded", "label": "Adjudicataria", "weight": 1, "flag": True},
            # Ex-subordinado pasa a la empresa (segunda puerta giratoria)
            {"s": 18, "t": 4, "type": "former_role", "label": "Director Vialidad (2018–2022)", "weight": 1},
            {"s": 18, "t": 2, "type": "owns", "label": "Gerente General (2023–)", "weight": 1, "flag": True},
            # Lyon también asesora a la subsidiaria
            {"s": 6, "t": 11, "type": "signed", "label": "Asesoría legal · Constructora del Sur", "weight": 1},
        ],
    },
    "errazuriz": {
        "id": "errazuriz",
        "rootId": 21,
        "nodes": [
            {"id": 21, "type": "person", "name": "María José Errázuriz Pinto", "subtitle": "Diputada — Comisión de Minería", "country": "CL", "risk": 64,
             "meta": {"rut": "13.456.789-0", "born": "1978", "party": "Coalición Centro", "terms": "2018–presente"}},
            {"id": 22, "type": "person", "name": "Tomás Errázuriz P.", "subtitle": "Hermano / Empresario", "country": "CL", "risk": 47,
             "meta": {"rut": "12.987.654-3", "role": "CEO MineraPacífico"}},
            {"id": 23, "type": "company", "name": "MineraPacífico Holdings", "country": "CL", "risk": 58,
             "meta": {"sector": "Minería — Cobre", "revenue": "USD 1.2B (2023)"}},
            {"id": 24, "type": "company", "name": "Fundación Horizonte Verde", "country": "CL", "risk": 33,
             "meta": {"sector": "ONG — Causas ambientales (de fachada según querella)"}},
            {"id": 25, "type": "contract", "name": "Audiencia de lobby #4421", "country": "CL", "risk": 49,
             "meta": {"date": "2023-06-12", "topic": "Royalty minero"}},
            {"id": 26, "type": "contract", "name": "Donación campaña 2021", "country": "CL", "risk": 51,
             "meta": {"amount": "CLP 28M", "source": "MineraPacífico via fundación"}},
            {"id": 27, "type": "company", "name": "Ley Royalty Minero — Voto", "country": "CL", "risk": 0, "isEntity": True},
            # Expansion
            {"id": 28, "type": "person", "name": "Pablo Errázuriz Pinto", "subtitle": "Hermano / Contador", "country": "CL", "risk": 38,
             "meta": {"rut": "14.234.567-K", "role": "Contador MineraPacífico + Cobre Andino"}},
            {"id": 29, "type": "company", "name": "Cobre Andino Ltda.", "country": "CL", "risk": 54,
             "meta": {"founded": "2017", "sector": "Minería — Cobre / Litio", "parent": "MineraPacífico (51%)"}},
            {"id": 30, "type": "contract", "name": "Concesión Minera Atacama Sur", "country": "CL", "risk": 67,
             "meta": {"amount": "USD 340M", "awarded": "2024-03-18", "duration": "30 años"}},
            {"id": 31, "type": "company", "name": "Ley Modificación Código Minero — Voto", "country": "CL", "risk": 0, "isEntity": True},
            {"id": 32, "type": "contract", "name": "Donación campaña 2025", "country": "CL", "risk": 53,
             "meta": {"amount": "CLP 34M", "source": "Vía Fundación Horizonte Verde (segunda vez)"}},
            {"id": 33, "type": "contract", "name": "Audiencia de lobby #6890", "country": "CL", "risk": 42,
             "meta": {"date": "2024-09-04", "topic": "Concesiones mineras zona norte"}},
            {"id": 34, "type": "company", "name": "Inmobiliaria Pacífico SpA", "country": "CL", "risk": 46,
             "meta": {"founded": "2020", "sector": "Inmobiliaria comercial", "owner": "Tomás Errázuriz 60%"}},
            {"id": 35, "type": "contract", "name": "Concesión Inmobiliaria Antofagasta", "country": "CL", "risk": 49,
             "meta": {"amount": "CLP 18.500M", "awarded": "2022-08-09", "duration": "20 años"}},
            {"id": 36, "type": "company", "name": "SERNAGEOMIN", "country": "CL", "risk": 0, "isEntity": True},
            {"id": 37, "type": "company", "name": "Estudio Echegaray & Cía.", "country": "CL", "risk": 44,
             "meta": {"sector": "Asesoría legal minera", "clients": "MineraPacífico, Cobre Andino"}},
        ],
        "edges": [
            # Originales
            {"s": 21, "t": 22, "type": "family_of", "label": "Hermana", "weight": 1},
            {"s": 22, "t": 23, "type": "owns", "label": "CEO + 12% accionista", "weight": 0.12},
            {"s": 23, "t": 24, "type": "donated_to", "label": "Aporte CLP 45M (2020–2023)", "weight": 1, "flag": True},
            {"s": 24, "t": 26, "type": "signed", "label": "Canalizó donación de campaña", "weight": 1, "flag": True},
            {"s": 26, "t": 21, "type": "donated_to", "label": "Recibió aporte CLP 28M", "weight": 1},
            {"s": 23, "t": 25, "type": "signed", "label": "Solicitó audiencia", "weight": 1},
            {"s": 25, "t": 21, "type": "signed", "label": "Recibió audiencia (Comisión Minería)", "weight": 1},
            {"s": 21, "t": 27, "type": "signed", "label": "Votó en contra del royalty (2023)", "weight": 1, "flag": True},
            # Segundo hermano (contador)
            {"s": 21, "t": 28, "type": "family_of", "label": "Hermana", "weight": 1},
            {"s": 28, "t": 23, "type": "signed", "label": "Contador MineraPacífico (2018–)", "weight": 1},
            # Subsidiaria minera + contrato grande
            {"s": 23, "t": 29, "type": "owns", "label": "Controla 51%", "weight": 0.51},
            {"s": 28, "t": 29, "type": "signed", "label": "Contador externo Cobre Andino", "weight": 1},
            {"s": 29, "t": 30, "type": "awarded", "label": "Adjudicataria · USD 340M", "weight": 1, "flag": True},
            # Segunda votación
            {"s": 21, "t": 31, "type": "signed", "label": "Votó a favor (Modificación Código Minero 2024)", "weight": 1, "flag": True},
            # Segunda donación canalizada
            {"s": 23, "t": 32, "type": "donated_to", "label": "Aporte CLP 50M (2024)", "weight": 1, "flag": True},
            {"s": 24, "t": 32, "type": "signed", "label": "Canalizó donación (segunda vez)", "weight": 1, "flag": True},
            {"s": 32, "t": 21, "type": "donated_to", "label": "Recibió aporte CLP 34M", "weight": 1},
            # Segunda audiencia de lobby (tardía)
            {"s": 23, "t": 33, "type": "signed", "label": "Solicitó audiencia (declarada 38 días tarde)", "weight": 1, "flag": True},
            {"s": 33, "t": 21, "type": "signed", "label": "Recibió audiencia", "weight": 1},
            # Hermano también dueño de inmobiliaria
            {"s": 22, "t": 34, "type": "owns", "label": "Socio 60%", "weight": 0.6},
            {"s": 34, "t": 35, "type": "awarded", "label": "Adjudicataria concesión inmobiliaria", "weight": 1},
            # Regulador que no fiscalizó
            {"s": 36, "t": 30, "type": "signed", "label": "No objetó concesión pese a observaciones", "weight": 1, "flag": True},
            # Estudio jurídico
            {"s": 37, "t": 23, "type": "signed", "label": "Asesoría legal MineraPacífico", "weight": 1},
            {"s": 37, "t": 29, "type": "signed", "label": "Asesoría legal Cobre Andino", "weight": 1},
            {"s": 37, "t": 21, "type": "signed", "label": "Asesoría legal pro-bono diputada", "weight": 1, "flag": True},
        ],
    },
    "losandes": {
        "id": "losandes",
        "rootId": 41,
        "nodes": [
            {"id": 41, "type": "company", "name": "Servicios Patagonia Express SpA", "country": "CL", "risk": 82,
             "meta": {"rut": "76.543.210-K", "founded": "2023-11-08", "sector": "Logística / Transporte"}},
            {"id": 42, "type": "contract", "name": "Suministro emergencia incendios — CONAF", "country": "CL", "risk": 76,
             "meta": {"amount": "CLP 7.800M", "awarded": "2024-02-19", "duration": "8 meses"}},
            {"id": 43, "type": "person", "name": "Roberto Mansilla Vargas", "subtitle": "Representante legal", "country": "CL", "risk": 54,
             "meta": {"rut": "16.234.567-1", "role": "Único socio declarado"}},
            {"id": 44, "type": "company", "name": "CONAF", "country": "CL", "risk": 0, "isEntity": True},
            {"id": 45, "type": "person", "name": "Pamela Sotomayor R.", "subtitle": "Jefa Adquisiciones CONAF", "country": "CL", "risk": 58,
             "meta": {"rut": "14.567.890-2"}},
            {"id": 46, "type": "company", "name": "GrupoMansilla Ltda.", "country": "CL", "risk": 47,
             "meta": {"sector": "Holding (3 empresas)"}},
            {"id": 47, "type": "company", "name": "Logística Austral S.A. (relacionada)", "country": "CL", "risk": 49,
             "meta": {"sector": "Transporte", "history": "Adjudicó contratos CONAF 2019–2022"}},
            # Expansion
            {"id": 48, "type": "person", "name": "Marisol Mansilla Vargas", "subtitle": "Hermana / Ex-CONAF / Gerente Patagonia Express", "country": "CL", "risk": 62,
             "meta": {"rut": "17.890.123-4", "role": "Analista CONAF 2019–2022 → Gerente Patagonia (2023–)"}},
            {"id": 49, "type": "contract", "name": "Caminos Forestales Aysén", "country": "CL", "risk": 58,
             "meta": {"amount": "CLP 4.500M", "awarded": "2022-07-14"}},
            {"id": 50, "type": "person", "name": "Eladio Sotomayor Reinike", "subtitle": "Hermano de Pamela", "country": "CL", "risk": 51,
             "meta": {"rut": "13.456.789-5", "role": "Dueño Transportes Sotomayor"}},
            {"id": 51, "type": "company", "name": "Transportes Sotomayor Ltda.", "country": "CL", "risk": 56,
             "meta": {"founded": "2018", "sector": "Transporte carga", "subcontracts": "Patagonia Express"}},
            {"id": 52, "type": "contract", "name": "Combustible Emergencia CONAF 2024", "country": "CL", "risk": 64,
             "meta": {"amount": "CLP 2.300M", "awarded": "2024-05-22"}},
            {"id": 53, "type": "contract", "name": "Subsidio Estatal Reactivación", "country": "CL", "risk": 41,
             "meta": {"amount": "CLP 1.800M", "awarded": "2024-07-30"}},
            {"id": 54, "type": "company", "name": "Forestal Patagonia Ltda.", "country": "CL", "risk": 48,
             "meta": {"founded": "2022", "sector": "Forestal", "parent": "GrupoMansilla (80%)"}},
            {"id": 55, "type": "contract", "name": "Reforestación Magallanes 2024", "country": "CL", "risk": 53,
             "meta": {"amount": "CLP 3.200M", "awarded": "2024-04-10"}},
            {"id": 56, "type": "company", "name": "Contraloría General de la República", "country": "CL", "risk": 0, "isEntity": True},
        ],
        "edges": [
            # Originales
            {"s": 43, "t": 41, "type": "owns", "label": "100% socio único", "weight": 1},
            {"s": 41, "t": 42, "type": "awarded", "label": "Adjudicataria — 11 días post-constitución", "weight": 1, "flag": True},
            {"s": 44, "t": 42, "type": "awarded", "label": "Adjudicó por trato directo", "weight": 1, "flag": True},
            {"s": 45, "t": 42, "type": "signed", "label": "Firmó adjudicación", "weight": 1},
            {"s": 43, "t": 46, "type": "owns", "label": "Beneficiario final", "weight": 1},
            {"s": 46, "t": 47, "type": "owns", "label": "Controla 80%", "weight": 0.8},
            {"s": 45, "t": 43, "type": "family_of", "label": "Ex-cuñados", "weight": 1, "flag": True},
            # Hermana puerta giratoria interna
            {"s": 43, "t": 48, "type": "family_of", "label": "Hermana", "weight": 1},
            {"s": 48, "t": 44, "type": "former_role", "label": "Analista CONAF (2019–2022)", "weight": 1},
            {"s": 48, "t": 41, "type": "owns", "label": "Gerente General (2023–)", "weight": 1, "flag": True},
            # Segundo contrato (Logística Austral)
            {"s": 47, "t": 49, "type": "awarded", "label": "Adjudicataria", "weight": 1},
            {"s": 44, "t": 49, "type": "awarded", "label": "Adjudicó trato directo", "weight": 1, "flag": True},
            # Sub-contratación intra-familia
            {"s": 45, "t": 50, "type": "family_of", "label": "Hermano", "weight": 1},
            {"s": 50, "t": 51, "type": "owns", "label": "Dueño 100%", "weight": 1},
            {"s": 41, "t": 51, "type": "signed", "label": "Subcontrata · CLP 1.200M (2024)", "weight": 1, "flag": True},
            # Más contratos CONAF a Patagonia
            {"s": 44, "t": 52, "type": "awarded", "label": "Adjudicó por trato directo", "weight": 1, "flag": True},
            {"s": 41, "t": 52, "type": "awarded", "label": "Adjudicataria · combustible", "weight": 1, "flag": True},
            # Subsidio estatal al grupo
            {"s": 46, "t": 53, "type": "awarded", "label": "Beneficiaria subsidio", "weight": 1},
            # Forestal Patagonia + reforestación
            {"s": 46, "t": 54, "type": "owns", "label": "Controla 80%", "weight": 0.8},
            {"s": 44, "t": 55, "type": "awarded", "label": "Adjudicó", "weight": 1},
            {"s": 54, "t": 55, "type": "awarded", "label": "Adjudicataria · vía empresa relacionada", "weight": 1, "flag": True},
            # Contraloría omite fiscalizar
            {"s": 56, "t": 42, "type": "signed", "label": "No objetó adjudicación pese a observaciones", "weight": 1, "flag": True},
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
