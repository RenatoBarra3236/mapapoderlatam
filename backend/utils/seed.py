import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import SessionLocal, engine
from config.database import Base
from models.node import Node
from models.edge import Edge

def seed_database():
    """Carga datos de ejemplo en la BD."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Limpiar datos existentes
    db.query(Edge).delete()
    db.query(Node).delete()
    db.commit()

    # PERSONAS
    carlos = Node(
        external_id="RUT-11111111-1",
        type="person",
        name="Carlos Fuentes Muñoz",
        country="CL",
        meta={"title": "Ex Subsecretario"},
        risk_score=85
    )
    ana = Node(
        external_id="RUT-22222222-2",
        type="person",
        name="Ana María Rojas Vidal",
        country="CL",
        meta={"title": "Concejala"},
        risk_score=60
    )
    roberto = Node(
        external_id="RUT-33333333-3",
        type="person",
        name="Roberto Fuentes Tapia",
        country="CL",
        meta={"title": "Empresario"},
        risk_score=70
    )
    marcela = Node(
        external_id="RUT-44444444-4",
        type="person",
        name="Marcela Soto Herrera",
        country="CL",
        meta={"title": "Directora Transparencia"},
        risk_score=45
    )

    db.add_all([carlos, ana, roberto, marcela])
    db.flush()

    # EMPRESAS
    constructora = Node(
        external_id="RUT-76111000-K",
        type="company",
        name="Constructora Los Andes SpA",
        country="CL",
        meta={"sector": "Construcción"},
        risk_score=75
    )
    servicios = Node(
        external_id="RUT-76222000-1",
        type="company",
        name="Servicios Digitales Fuentes SA",
        country="CL",
        meta={"sector": "Tecnología"},
        risk_score=80
    )
    consultora = Node(
        external_id="RUT-76333000-2",
        type="company",
        name="Consultora Gestión Pública Ltda",
        country="CL",
        meta={"sector": "Consultoría"},
        risk_score=55
    )

    db.add_all([constructora, servicios, consultora])
    db.flush()

    # CONTRATOS
    ruta5 = Node(
        external_id="ID-CONT-2022-001",
        type="contract",
        name="Licitación Ruta 5 Sur",
        country="CL",
        meta={"amount": 4500000000, "currency": "CLP", "year": 2022, "organism": "MOP"},
        risk_score=90
    )
    oirs = Node(
        external_id="ID-CONT-2023-047",
        type="contract",
        name="Modernización OIRS Santiago",
        country="CL",
        meta={"amount": 185000000, "currency": "CLP", "year": 2023, "organism": "SEGPRES"},
        risk_score=65
    )
    regulador = Node(
        external_id="ID-CONT-2021-088",
        type="contract",
        name="Plan Regulador Comunal",
        country="CL",
        meta={"amount": 95000000, "currency": "CLP", "year": 2021, "organism": "MINVU"},
        risk_score=50
    )

    db.add_all([ruta5, oirs, regulador])
    db.flush()

    # RELACIONES (EDGES)
    edges = [
        # Ownership: Roberto es hijo de Carlos
        Edge(source_id=carlos.id, target_id=roberto.id, type="family_of", label="padre"),
        # Ownership: Roberto dueño de Servicios Digitales
        Edge(source_id=roberto.id, target_id=servicios.id, type="owns", weight=0.8),
        # Ownership: Carlos dueño de Constructora
        Edge(source_id=carlos.id, target_id=constructora.id, type="owns", weight=0.9),
        # Awards: Constructora ganó Ruta 5
        Edge(source_id=constructora.id, target_id=ruta5.id, type="awarded", weight=1.0),
        # Signed: Carlos firmó Ruta 5 (como Subsecretario)
        Edge(source_id=carlos.id, target_id=ruta5.id, type="signed", weight=0.95),
        # Awards: Servicios Digitales ganó OIRS
        Edge(source_id=servicios.id, target_id=oirs.id, type="awarded", weight=0.8),
        # Signed: Ana firmó OIRS
        Edge(source_id=ana.id, target_id=oirs.id, type="signed", weight=0.7),
        # Awards: Consultora ganó Plan Regulador
        Edge(source_id=consultora.id, target_id=regulador.id, type="awarded", weight=0.6),
        # Donated: Ana donó a consultora
        Edge(source_id=ana.id, target_id=consultora.id, type="donated_to", weight=0.5),
        # Former role: Marcela fue directora en Consultora
        Edge(source_id=marcela.id, target_id=consultora.id, type="former_role", weight=0.7),
    ]

    db.add_all(edges)
    db.commit()

    print("✓ Base de datos inicializada con datos de ejemplo")
    print(f"  - {db.query(Node).count()} nodos")
    print(f"  - {db.query(Edge).count()} relaciones")
    db.close()

if __name__ == "__main__":
    seed_database()
