const express = require('express');
const router  = express.Router();
const searchController = require('../controllers/searchController');

// GET /api/search?q=nombre&type=person&country=CL&limit=10
router.get('/', searchController.search);

module.exports = router;
