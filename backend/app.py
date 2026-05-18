import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routes import graph, search, ai, flags, appeals
from config.settings import get_settings

load_dotenv()

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa tablas y seed al arrancar."""
    try:
        from config.database import Base, engine, SessionLocal
        from models.node import Node
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            count = db.query(Node).count()
            if count == 0:
                from utils.seed import seed_database
                seed_database()
                print("✓ Base de datos inicializada con datos de ejemplo")
        finally:
            db.close()
    except Exception as e:
        print(f"⚠ DB init: {e}")
    yield

app = FastAPI(
    title="Mapa de Poder LATAM API",
    description="API para explorar redes de poder político y empresarial",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}

# DB diagnostics (solo para debug — borrar después)
@app.get("/api/dbcheck")
async def db_check():
    try:
        from config.database import engine, SessionLocal
        from models.node import Node
        db = SessionLocal()
        count = db.query(Node).count()
        db.close()
        db_url = str(engine.url).split("@")[-1]  # oculta credenciales
        return {"status": "ok", "nodes": count, "host": db_url}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

# Rutas
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(flags.router, prefix="/api/flags", tags=["flags"])
app.include_router(appeals.router, prefix="/api/appeals", tags=["appeals"])

if __name__ == "__main__":
    import uvicorn
    port = settings.PORT
    uvicorn.run(app, host="0.0.0.0", port=port)
