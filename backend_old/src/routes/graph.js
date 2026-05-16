const express = require('express');
const router  = express.Router();
const graphController = require('../controllers/graphController');

// GET /api/graph/:nodeId?depth=2
// Devuelve el subgrafo centrado en nodeId hasta N grados de separación
router.get('/:nodeId', graphController.getSubgraph);

// GET /api/graph/:nodeId/stats
// Estadísticas del nodo: # contratos, montos totales, etc.
router.get('/:nodeId/stats', graphController.getNodeStats);

module.exports = router;
