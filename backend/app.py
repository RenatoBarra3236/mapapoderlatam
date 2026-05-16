import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routes import graph, search
from config.settings import get_settings

load_dotenv()

settings = get_settings()

app = FastAPI(
    title="Mapa de Poder LATAM API",
    description="API para explorar redes de poder político y empresarial",
    version="1.0.0"
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

# Rutas
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(search.router, prefix="/api/search", tags=["search"])

if __name__ == "__main__":
    import uvicorn
    port = settings.PORT
    uvicorn.run(app, host="0.0.0.0", port=port)
