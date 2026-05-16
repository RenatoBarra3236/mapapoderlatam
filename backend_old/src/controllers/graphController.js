const db = require('../../config/db');

// GET /api/graph/:nodeId?depth=2
// Usa un CTE recursivo para expandir el grafo hasta `depth` grados
const getSubgraph = async (req, res) => {
  const nodeId = parseInt(req.params.nodeId, 10);
  const depth  = Math.min(parseInt(req.query.depth || 2, 10), 3); // máximo 3 grados

  if (isNaN(nodeId)) {
    return res.status(400).json({ error: 'nodeId inválido' });
  }

  try {
    // 1. Obtener todos los nodos alcanzables dentro de `depth` grados
    const reachableSql = `
      WITH RECURSIVE traversal AS (
        -- Nodo raíz (profundidad 0)
        SELECT id, 0 AS depth
        FROM nodes
        WHERE id = $1

        UNION ALL

        -- Expandir por aristas en ambas direcciones
        SELECT
          CASE
            WHEN e.source_id = t.id THEN e.target_id
            ELSE e.source_id
          END AS id,
          t.depth + 1
        FROM traversal t
        JOIN edges e ON e.source_id = t.id OR e.target_id = t.id
        WHERE t.depth < $2
      )
      SELECT DISTINCT id FROM traversal
    `;

    const { rows: reachableRows } = await db.query(reachableSql, [nodeId, depth]);
    const nodeIds = reachableRows.map((r) => r.id);

    if (nodeIds.length === 0) {
      return res.json({ nodes: [], edges: [] });
    }

    // 2. Obtener datos de esos nodos
    const nodesSql = `
      SELECT id, external_id, type, name, country, risk_score, metadata
      FROM nodes
      WHERE id = ANY($1::int[])
    `;
    const { rows: nodes } = await db.query(nodesSql, [nodeIds]);

    // 3. Obtener aristas entre esos nodos
    const edgesSql = `
      SELECT id, source_id, target_id, type, label, weight, source_url, metadata
      FROM edges
      WHERE source_id = ANY($1::int[])
        AND target_id = ANY($1::int[])
    `;
    const { rows: edges } = await db.query(edgesSql, [nodeIds]);

    // 4. Marcar el nodo raíz para que el frontend lo centre
    const formattedNodes = nodes.map((n) => ({
      ...n,
      is_root: n.id === nodeId,
    }));

    res.json({ nodes: formattedNodes, edges });
  } catch (err) {
    console.error('Error al obtener subgrafo:', err);
    res.status(500).json({ error: 'Error al obtener el grafo' });
  }
};

// GET /api/graph/:nodeId/stats
const getNodeStats = async (req, res) => {
  const nodeId = parseInt(req.params.nodeId, 10);

  if (isNaN(nodeId)) {
    return res.status(400).json({ error: 'nodeId inválido' });
  }

  try {
    const sql = `
      SELECT
        n.id,
        n.name,
        n.type,
        n.risk_score,
        nd.total_degree AS connections,
        nd.out_degree,
        nd.in_degree,
        (
          SELECT COUNT(*)
          FROM edges e
          JOIN nodes n2 ON n2.id = CASE WHEN e.source_id = n.id THEN e.target_id ELSE e.source_id END
          WHERE (e.source_id = n.id OR e.target_id = n.id)
            AND n2.type = 'contract'
        ) AS contract_count,
        (
          SELECT COALESCE(SUM((n2.metadata->>'amount')::NUMERIC), 0)
          FROM edges e
          JOIN nodes n2 ON n2.id = CASE WHEN e.source_id = n.id THEN e.target_id ELSE e.source_id END
          WHERE (e.source_id = n.id OR e.target_id = n.id)
            AND n2.type = 'contract'
            AND n2.metadata->>'amount' IS NOT NULL
        ) AS total_amount
      FROM nodes n
      JOIN node_degree nd ON nd.id = n.id
      WHERE n.id = $1
    `;

    const { rows } = await db.query(sql, [nodeId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Nodo no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error al obtener stats del nodo:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

module.exports = { getSubgraph, getNodeStats };
