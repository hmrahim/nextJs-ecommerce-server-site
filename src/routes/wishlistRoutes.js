/**
 * 📁 src/routes/wishlistRoutes.js
 *
 * Notun toggle endpoint add kora hoyeche: POST /api/wishlist/toggle
 * Tomar existing routes file e ei line ta add kore daw — baki
 * routes jegulo already ache segulo same rakho.
 *
 * Full file example below — replace kore daw jodi structure miley jaye.
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getWishlist,
  addItem,
  removeItem,
  toggleItem,
  clearWishlist,
  checkItem,
  moveAllToCart,
} = require('../controllers/wishlistController');

router.use(protect);

router.get('/wishlist', getWishlist);
router.delete('/wishlist', clearWishlist);

router.post('/wishlist/items', addItem);
router.delete('/wishlist/items/:productId', removeItem);

// NEW — server-authoritative toggle (recommended for ProductCard heart)
router.post('/wishlist/toggle', toggleItem);

router.get('/wishlist/check/:productId', checkItem);
router.post('/wishlist/move-to-cart', moveAllToCart);

module.exports = router;
