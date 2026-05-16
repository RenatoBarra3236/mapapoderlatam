#!/usr/bin/env python3
"""
Script para inicializar la base de datos MySQL.
Ejecutar: python init_db.py
"""

import sys
import os
import subprocess
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import get_settings
from config.database import engine, Base
from models.node import Node
from models.edge import Edge
from utils.seed import seed_database

def init_db():
    """Crea las tablas y carga datos iniciales."""
    print("🔄 Inicializando base de datos...")

    # Crear tablas
    print("📋 Creando tablas...")
    Base.metadata.create_all(bind=engine)
    print("✓ Tablas creadas")

    # Cargar datos de ejemplo
    print("🌱 Cargando datos de ejemplo...")
    seed_database()

    print("\n✅ Base de datos inicializada correctamente")
    print("   Puedes iniciar el servidor con: python -m uvicorn app:app --reload")

if __name__ == "__main__":
    init_db()
