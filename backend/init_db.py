#!/usr/bin/env python3
"""
Helper de desarrollo. En producción usa Alembic:

    alembic upgrade head
"""

from config.database import Base, engine
from models import Entity, EntityIdentifier, IngestionRun, RawRecord, Relationship, RiskFlag, Source
def init_db():
    Base.metadata.create_all(bind=engine)
    print("Base de desarrollo inicializada. Para producción usa: alembic upgrade head")


if __name__ == "__main__":
    init_db()
