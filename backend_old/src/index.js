require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const graphRoutes  = require('./routes/graph');
const searchRoutes = require('./routes/search');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Log simple de requests en desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ── Rutas ───────────────────────────────────────────────────
app.use('/api/graph',  graphRoutes);
app.use('/api/search', searchRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// ── Error handler ───────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
