const db = require('../../config/db');

// GET /api/search?q=nombre&type=person&country=CL&limit=10
const search = async (req, res) => {
  const { q = '', type, country, limit = 10 } = req.query;

  if (q.trim().length < 2) {
    return res.status(400).json({ error: 'El término de búsqueda debe tener al menos 2 caracteres' });
  }

  try {
    // Construcción dinámica del WHERE
    const conditions = [`to_tsvector('spanish', name) @@ plainto_tsquery('spanish', $1)`];
    const params     = [q.trim()];
    let   idx        = 2;

    if (type) {
      conditions.push(`type = $${idx++}`);
      params.push(type);
    }
    if (country) {
      conditions.push(`country = $${idx++}`);
      params.push(country.toUpperCase());
    }

    params.push(parseInt(limit, 10));

    const sql = `
      SELECT
        id,
        external_id,
        type,
        name,
        country,
        risk_score,
        metadata
      FROM nodes
      WHERE ${conditions.join(' AND ')}
      ORDER BY risk_score DESC, name ASC
      LIMIT $${idx}
    `;

    const { rows } = await db.query(sql, params);
    res.json({ results: rows, total: rows.length });
  } catch (err) {
    console.error('Error en búsqueda:', err);
    res.status(500).json({ error: 'Error al buscar' });
  }
};

module.exports = { search };
