-- =============================================
-- SCHEMA: Mapa de Poder Político LATAM
-- =============================================

-- Tipos posibles de nodo
-- 'person'   → funcionario, político, empresario
-- 'company'  → empresa, ONG, fundación
-- 'contract' → licitación o contrato público

CREATE TABLE IF NOT EXISTS nodes (
  id          SERIAL PRIMARY KEY,
  external_id TEXT UNIQUE,           -- RUT, ID de licitación, etc.
  type        TEXT NOT NULL CHECK (type IN ('person', 'company', 'contract')),
  name        TEXT NOT NULL,
  country     TEXT NOT NULL DEFAULT 'CL',
  metadata    JSONB DEFAULT '{}',    -- cargo, monto, fecha, etc.
  risk_score  INTEGER DEFAULT 0,     -- calculado al insertar edges
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Tipos posibles de relación (edge)
-- 'owns'          → persona es dueña/socia de empresa
-- 'awarded'       → empresa ganó contrato
-- 'signed'        → funcionario firmó contrato
-- 'donated_to'    → persona donó a campaña (node tipo person)
-- 'family_of'     → relación familiar entre personas
-- 'former_role'   → persona tuvo cargo en empresa/institución

CREATE TABLE IF NOT EXISTS edges (
  id          SERIAL PRIMARY KEY,
  source_id   INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id   INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  label       TEXT,                  -- descripción legible de la relación
  weight      NUMERIC DEFAULT 1.0,   -- fuerza de la conexión (ej: monto en millones)
  source_url  TEXT,                  -- URL al documento original
  valid_from  DATE,
  valid_to    DATE,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (source_id, target_id, type)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_nodes_name    ON nodes USING GIN (to_tsvector('spanish', name));
CREATE INDEX IF NOT EXISTS idx_nodes_type    ON nodes (type);
CREATE INDEX IF NOT EXISTS idx_nodes_country ON nodes (country);
CREATE INDEX IF NOT EXISTS idx_edges_source  ON edges (source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target  ON edges (target_id);

-- Vista: nodos con su grado de conectividad (útil para el risk_score)
CREATE OR REPLACE VIEW node_degree AS
SELECT
  n.id,
  n.name,
  n.type,
  n.country,
  COUNT(DISTINCT e1.id) AS out_degree,
  COUNT(DISTINCT e2.id) AS in_degree,
  COUNT(DISTINCT e1.id) + COUNT(DISTINCT e2.id) AS total_degree
FROM nodes n
LEFT JOIN edges e1 ON e1.source_id = n.id
LEFT JOIN edges e2 ON e2.target_id = n.id
GROUP BY n.id;
