/**
 * ingest_chilecompra.js
 * Descarga licitaciones desde la API pública de ChileCompra (Mercado Público)
 * y las carga en la base de datos.
 *
 * Docs API: https://api.mercadopublico.cl/
 * Ejecutar: node data/scripts/ingest_chilecompra.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const https = require('https');
const db    = require('../../backend/config/db');

const CHILECOMPRA_API = 'https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json';

// Trae las últimas N licitaciones adjudicadas
async function fetchLicitaciones(cantidad = 50) {
  return new Promise((resolve, reject) => {
    const url = `${CHILECOMPRA_API}?cantidad=${cantidad}&estado=adjudicada&ticket=${process.env.CHILECOMPRA_TICKET || 'TOKEN_AQUI'}`;
    https.get(url, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error('Error al parsear respuesta de ChileCompra'));
        }
      });
    }).on('error', reject);
  });
}

// Inserta o actualiza un nodo, devuelve su id
async function upsertNode(externalId, type, name, country, metadata) {
  const { rows } = await db.query(
    `INSERT INTO nodes (external_id, type, name, country, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (external_id) DO UPDATE SET metadata = EXCLUDED.metadata
     RETURNING id`,
    [externalId, type, name, country, JSON.stringify(metadata)]
  );
  return rows[0].id;
}

// Inserta una arista si no existe
async function upsertEdge(sourceId, targetId, type, label, weight) {
  await db.query(
    `INSERT INTO edges (source_id, target_id, type, label, weight)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (source_id, target_id, type) DO NOTHING`,
    [sourceId, targetId, type, label, weight]
  );
}

async function ingest() {
  console.log('Descargando licitaciones de ChileCompra...');
  const data = await fetchLicitaciones(100);

  if (!data.Listado) {
    console.error('Respuesta inesperada:', data);
    process.exit(1);
  }

  console.log(`Procesando ${data.Listado.length} licitaciones...\n`);

  for (const licitacion of data.Listado) {
    try {
      // 1. Nodo contrato
      const contractId = await upsertNode(
        licitacion.CodigoExterno,
        'contract',
        licitacion.Nombre,
        'CL',
        {
          amount:   licitacion.MontoEstimado,
          currency: 'CLP',
          year:     new Date(licitacion.FechaPublicacion).getFullYear(),
          organism: licitacion.Comprador?.NombreOrganismo,
        }
      );

      // 2. Nodo empresa adjudicada (si existe)
      if (licitacion.Adjudicacion?.RutProveedor) {
        const companyId = await upsertNode(
          `RUT-${licitacion.Adjudicacion.RutProveedor}`,
          'company',
          licitacion.Adjudicacion.NombreProveedor,
          'CL',
          { sector: 'Sin clasificar' }
        );
        await upsertEdge(companyId, contractId, 'awarded', 'Empresa adjudicada', licitacion.MontoEstimado / 1_000_000);
        console.log(`  ✓ ${licitacion.Adjudicacion.NombreProveedor} → ${licitacion.Nombre}`);
      }
    } catch (err) {
      console.error(`  ✗ Error en licitación ${licitacion.CodigoExterno}:`, err.message);
    }
  }

  // Actualizar risk_score
  await db.query(`
    UPDATE nodes n
    SET risk_score = nd.total_degree * 10
    FROM node_degree nd
    WHERE nd.id = n.id
  `);

  console.log('\nIngesta completada.');
  process.exit(0);
}

ingest().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
