// 📁 PATH: routes/index.js
'use strict';

const express = require('express');
const router = express.Router();

// ── Auth ──────────────────────────────────────────────────
router.use(require('./userRoutes'));    
router.use( require('./routes'));
router.use( require('./categoryRoute'));
router.use( require('./productRoute'));
router.use( require('./productVariantRoutes'));
router.use( require('./attributeroute'));
router.use( require('./brandRoute'));
router.use( require('./bannerRoute'));
router.use( require('./blogRoutes'));
router.use( require('./ReviewRoutes'));
router.use( require('./searchRoutes'));
router.use( require('./cartRoutes'));
router.use( require('./couponRoutes'));
router.use( require('./orderRoutes'));
router.use( require('./wishlistRoutes'));
router.use( require('./flashSaleRoutes'));
router.use( require('./quotationRoutes'));

module.exports = router;