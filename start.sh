#!/usr/bin/env bash
# Arranca backend (FastAPI) + frontend (Vite) desde una sola terminal.
# Ctrl-C apaga ambos.

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Verifica deps mínimas
if [ ! -d "$ROOT/backend/venv" ]; then
  echo "❌ No existe backend/venv. Corre primero el setup:"
  echo "   cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

if [ ! -f "$ROOT/backend/.env" ]; then
  echo "❌ Falta backend/.env. Copia el ejemplo y pega tu API key:"
  echo "   cp backend/.env.example backend/.env"
  echo "   # luego edita ANTHROPIC_API_KEY en backend/.env"
  exit 1
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "❌ Faltan deps del frontend. Corre primero:"
  echo "   cd frontend && npm install"
  exit 1
fi

# Limpia el puerto del backend si quedó algo colgado
if lsof -ti :3001 > /dev/null 2>&1; then
  echo "⚠ Puerto 3001 ocupado, liberándolo..."
  lsof -ti :3001 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Apaga ambos procesos cuando le des Ctrl-C
cleanup() {
  echo ""
  echo "🛑 Apagando..."
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Backend
echo "🟢 Arrancando backend en http://localhost:3001"
cd "$ROOT/backend"
source venv/bin/activate
python -m uvicorn app:app --reload --port 3001 > /tmp/redpoder-backend.log 2>&1 &
BACKEND_PID=$!

# Frontend
echo "🟢 Arrancando frontend en http://localhost:5173"
cd "$ROOT/frontend"
npm run dev > /tmp/redpoder-frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 2
echo ""
echo "✅ Listo. Abre http://localhost:5173 en el navegador."
echo "📜 Logs:"
echo "   tail -f /tmp/redpoder-backend.log"
echo "   tail -f /tmp/redpoder-frontend.log"
echo ""
echo "Presiona Ctrl-C para apagar todo."

# Espera a que cualquiera de los dos muera
wait
