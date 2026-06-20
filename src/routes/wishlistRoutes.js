/**
 * 📁 src/routes/wishlistRoutes.js
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
// Also accept POST remove (defensive — some clients can't send DELETE w/ body)
router.post('/wishlist/items/remove', removeItem);

// Server-authoritative toggle — RECOMMENDED for heart button
router.post('/wishlist/toggle', toggleItem);

router.get('/wishlist/check/:productId', checkItem);
router.post('/wishlist/move-to-cart', moveAllToCart);

module.exports = router;
