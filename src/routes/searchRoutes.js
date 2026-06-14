// 📁 PATH: backend/routes/searchRoutes.js
// Mount: app.use('/api/products', require('./routes/searchRoutes'));
// Endpoint: GET /api/products/search

const express = require('express');
const router = express.Router();
const { searchProducts } = require('../controllers/searchController');

router.get('/search', searchProducts);

module.exports = router;
