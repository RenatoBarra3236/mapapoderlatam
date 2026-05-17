import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routes import cases, entities, graph, search
from config.settings import get_settings

load_dotenv()

settings = get_settings()

app = FastAPI(
    title="Mapa de Poder LATAM API",
    description="API para explorar redes de poder político y empresarial",
    version="1.0.0"
)

cors_origins = settings.cors_origins if settings.ENVIRONMENT != "production" else settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0", "database": "postgresql"}

# Rutas
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(entities.router, prefix="/api/entities", tags=["entities"])
app.include_router(cases.router, prefix="/api/cases", tags=["cases"])

if __name__ == "__main__":
    import uvicorn
    port = settings.PORT
    uvicorn.run(app, host="0.0.0.0", port=port)
