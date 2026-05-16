/**
 * seed.js — carga datos de ejemplo para desarrollo/demo
 * Ejecutar con: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('../../config/db');

const NODES = [
  // Personas
  { external_id: 'RUT-11111111-1', type: 'person',   name: 'Carlos Fuentes Muñoz',    country: 'CL', metadata: { role: 'Ex Subsecretario de Obras Públicas', party: 'Partido Demo' } },
  { external_id: 'RUT-22222222-2', type: 'person',   name: 'Ana María Rojas Vidal',   country: 'CL', metadata: { role: 'Concejala Municipalidad Santiago',    party: 'Partido Progreso' } },
  { external_id: 'RUT-33333333-3', type: 'person',   name: 'Roberto Fuentes Tapia',   country: 'CL', metadata: { role: 'Empresario',                          note: 'Hijo de Carlos Fuentes' } },
  { external_id: 'RUT-44444444-4', type: 'person',   name: 'Marcela Soto Herrera',    country: 'CL', metadata: { role: 'Directora Corporación Transparencia CL' } },

  // Empresas
  { external_id: 'RUT-76111000-K', type: 'company',  name: 'Constructora Los Andes SpA',    country: 'CL', metadata: { sector: 'Construcción', founded: '2015' } },
  { external_id: 'RUT-76222000-1', type: 'company',  name: 'Servicios Digitales Fuentes SA', country: 'CL', metadata: { sector: 'Tecnología',    founded: '2018' } },
  { external_id: 'RUT-76333000-2', type: 'company',  name: 'Consultora Gestión Pública Ltda', country: 'CL', metadata: { sector: 'Consultoría',   founded: '2012' } },

  // Contratos
  { external_id: 'ID-CONT-2022-001', type: 'contract', name: 'Licitación Ruta 5 Sur — Tramo Chillán',      country: 'CL', metadata: { amount: 4500000000, currency: 'CLP', year: 2022, organism: 'MOP' } },
  { external_id: 'ID-CONT-2023-047', type: 'contract', name: 'Modernización Sistema OIRS Municipalidad',   country: 'CL', metadata: { amount: 185000000,  currency: 'CLP', year: 2023, organism: 'Municipalidad Santiago' } },
  { external_id: 'ID-CONT-2021-088', type: 'contract', name: 'Consultoría Plan Regulador Comunal 2021-25', country: 'CL', metadata: { amount: 95000000,   currency: 'CLP', year: 2021, organism: 'Municipalidad Santiago' } },
];

const EDGES = [
  // Carlos Fuentes es socio de Constructora Los Andes
  { source: 'RUT-11111111-1', target: 'RUT-76111000-K', type: 'owns',       label: 'Socio fundador (40%)',         weight: 0.4 },
  // Roberto Fuentes (hijo) también es socio de la misma constructora
  { source: 'RUT-33333333-3', target: 'RUT-76111000-K', type: 'owns',       label: 'Socio (35%)',                  weight: 0.35 },
  // Constructora Los Andes ganó la licitación de la ruta
  { source: 'RUT-76111000-K', target: 'ID-CONT-2022-001', type: 'awarded',  label: 'Adjudicación directa',         weight: 4500 },
  // Carlos Fuentes firmó ese contrato como subsecretario
  { source: 'RUT-11111111-1', target: 'ID-CONT-2022-001', type: 'signed',   label: 'Firmó como Subsecretario',     weight: 1.0 },
  // Carlos Fuentes es padre de Roberto
  { source: 'RUT-11111111-1', target: 'RUT-33333333-3',   type: 'family_of', label: 'Relación padre-hijo',         weight: 1.0 },
  // Ana Rojas y Servicios Digitales
  { source: 'RUT-22222222-2', target: 'RUT-76222000-1',   type: 'owns',     label: 'Socia mayoritaria (60%)',      weight: 0.6 },
  { source: 'RUT-76222000-1', target: 'ID-CONT-2023-047', type: 'awarded',  label: 'Adjudicación licitación pública', weight: 185 },
  { source: 'RUT-22222222-2', target: 'ID-CONT-2023-047', type: 'signed',   label: 'Firmó como Concejala',         weight: 1.0 },
  // Consultora y Marcela Soto
  { source: 'RUT-44444444-4', target: 'RUT-76333000-2',   type: 'former_role', label: 'Ex directora ejecutiva',    weight: 0.8 },
  { source: 'RUT-76333000-2', target: 'ID-CONT-2021-088', type: 'awarded',  label: 'Contrato de consultoría',      weight: 95 },
];

async function seed() {
  console.log('Iniciando seed...\n');

  // Limpiar tablas
  await db.query('TRUNCATE edges, nodes RESTART IDENTITY CASCADE');

  // Insertar nodos
  const nodeMap = {};
  for (const node of NODES) {
    const { rows } = await db.query(
      `INSERT INTO nodes (external_id, type, name, country, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [node.external_id, node.type, node.name, node.country, JSON.stringify(node.metadata)]
    );
    nodeMap[node.external_id] = rows[0].id;
    console.log(`  Nodo [${node.type}]: ${node.name}`);
  }

  // Insertar aristas
  console.log('\nAristas:');
  for (const edge of EDGES) {
    const sourceId = nodeMap[edge.source];
    const targetId = nodeMap[edge.target];
    await db.query(
      `INSERT INTO edges (source_id, target_id, type, label, weight)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_id, target_id, type) DO NOTHING`,
      [sourceId, targetId, edge.type, edge.label, edge.weight]
    );
    console.log(`  ${edge.source} --[${edge.type}]--> ${edge.target}`);
  }

  // Actualizar risk_score basado en grado de conectividad
  await db.query(`
    UPDATE nodes n
    SET risk_score = nd.total_degree * 10
    FROM node_degree nd
    WHERE nd.id = n.id
  `);

  console.log('\nSeed completado.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
