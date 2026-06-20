/**
 * 📁 src/controllers/wishlistController.js
 *
 * Production-grade wishlist controller.
 *  • Atomic $addToSet / $pull (no race conditions, no lost product ids)
 *  • Accepts productId from body, params, OR query (defensive)
 *  • Full request logging so you can SEE what frontend sends
 *  • Server-authoritative toggle endpoint
 *  • Idempotent remove (returns 200 even if not present)
 */

const mongoose = require('mongoose');
const WishlistModel = require('../models/WishlistModel');

/* ── helpers ─────────────────────────────────────────────────── */
const toId = (id) => new mongoose.Types.ObjectId(String(id));

const extractProductId = (req) =>
  req.body?.productId ||
  req.body?.product ||
  req.body?.id ||
  req.body?._id ||
  req.params?.productId ||
  req.params?.id ||
  req.query?.productId ||
  null;

const isValidId = (id) => !!id && mongoose.isValidObjectId(String(id));

const populateItems = (doc) =>
  doc.populate({
    path: 'items.product',
    select:
      'name slug images price comparePrice avgRating reviewCount brand inStock stock isActive',
    populate: { path: 'brand', select: 'name logo' },
  });

const serialize = (wishlist) => {
  const items = (wishlist.items || []).filter((i) => {
    if (!i.product) return false;
    if (typeof i.product === 'object' && 'isActive' in i.product) {
      return i.product.isActive !== false;
    }
    return true;
  });
  return {
    _id: wishlist._id,
    items,
    itemCount: items.length,
    updatedAt: wishlist.updatedAt,
  };
};

const ensureWishlist = async (userId) => {
  // upsert empty wishlist if not exists — atomic, no race
  return WishlistModel.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

/* ── GET /api/wishlist ───────────────────────────────────────── */
const getWishlist = async (req, res) => {
  try {
    const wishlist = await ensureWishlist(req.user._id);
    await populateItems(wishlist);
    return res.status(200).json({ success: true, data: serialize(wishlist) });
  } catch (err) {
    console.error('[Wishlist] getWishlist error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── POST /api/wishlist/items ────────────────────────────────── */
const addItem = async (req, res) => {
  try {
    const productId = extractProductId(req);
    console.log('[Wishlist] addItem → user:', String(req.user?._id), 'productId:', productId, 'body:', req.body);

    if (!isValidId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing productId',
        received: { body: req.body, params: req.params },
      });
    }

    const pid = toId(productId);

    // Atomic upsert + addToSet (de-duped by product id)
    // Step 1: ensure wishlist exists
    await ensureWishlist(req.user._id);

    // Step 2: $addToSet by product id (won't add duplicate)
    const updated = await WishlistModel.findOneAndUpdate(
      { user: req.user._id, 'items.product': { $ne: pid } },
      { $push: { items: { product: pid, addedAt: new Date() } } },
      { new: true }
    );

    // If updated is null → item was already present; fetch current
    const wishlist =
      updated || (await WishlistModel.findOne({ user: req.user._id }));

    await populateItems(wishlist);
    return res.status(200).json({
      success: true,
      message: updated ? 'Added to wishlist' : 'Already in wishlist',
      action: 'added',
      data: serialize(wishlist),
    });
  } catch (err) {
    console.error('[Wishlist] addItem error:', err, 'body:', req.body);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── DELETE /api/wishlist/items/:productId ───────────────────── */
const removeItem = async (req, res) => {
  try {
    const productId = extractProductId(req);
    console.log('[Wishlist] removeItem → user:', String(req.user?._id), 'productId:', productId);

    if (!isValidId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing productId',
        received: { body: req.body, params: req.params },
      });
    }

    const pid = toId(productId);

    await ensureWishlist(req.user._id);

    const wishlist = await WishlistModel.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { items: { product: pid } } },
      { new: true }
    );

    await populateItems(wishlist);
    return res.status(200).json({
      success: true,
      message: 'Removed from wishlist',
      action: 'removed',
      data: serialize(wishlist),
    });
  } catch (err) {
    console.error('[Wishlist] removeItem error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── POST /api/wishlist/toggle ───────────────────────────────── */
const toggleItem = async (req, res) => {
  try {
    const productId = extractProductId(req);
    console.log('[Wishlist] toggleItem → user:', String(req.user?._id), 'productId:', productId, 'body:', req.body);

    if (!isValidId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing productId',
        received: { body: req.body, params: req.params },
      });
    }

    const pid = toId(productId);

    // ensure wishlist exists
    await ensureWishlist(req.user._id);

    // Try to push only if not present
    const added = await WishlistModel.findOneAndUpdate(
      { user: req.user._id, 'items.product': { $ne: pid } },
      { $push: { items: { product: pid, addedAt: new Date() } } },
      { new: true }
    );

    let wishlist;
    let action;
    if (added) {
      wishlist = added;
      action = 'added';
    } else {
      // already present → remove
      wishlist = await WishlistModel.findOneAndUpdate(
        { user: req.user._id },
        { $pull: { items: { product: pid } } },
        { new: true }
      );
      action = 'removed';
    }

    await populateItems(wishlist);
    return res.status(200).json({
      success: true,
      message: action === 'added' ? 'Added to wishlist' : 'Removed from wishlist',
      action,
      data: serialize(wishlist),
    });
  } catch (err) {
    console.error('[Wishlist] toggleItem error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── DELETE /api/wishlist ────────────────────────────────────── */
const clearWishlist = async (req, res) => {
  try {
    await WishlistModel.findOneAndUpdate(
      { user: req.user._id },
      { $set: { items: [] } },
      { new: true, upsert: true }
    );
    return res.status(200).json({
      success: true,
      message: 'Wishlist cleared',
      data: { items: [], itemCount: 0 },
    });
  } catch (err) {
    console.error('[Wishlist] clearWishlist error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── GET /api/wishlist/check/:productId ──────────────────────── */
const checkItem = async (req, res) => {
  try {
    const productId = extractProductId(req);
    if (!isValidId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing productId',
      });
    }
    const pid = toId(productId);
    const wishlist = await WishlistModel.findOne({ user: req.user._id }).lean();
    const inWishlist = wishlist
      ? wishlist.items.some((i) => i.product?.toString() === pid.toString())
      : false;
    return res.status(200).json({ success: true, data: { inWishlist } });
  } catch (err) {
    console.error('[Wishlist] checkItem error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── POST /api/wishlist/move-to-cart ─────────────────────────── */
const moveAllToCart = async (req, res) => {
  try {
    const wishlist = await WishlistModel.findOne({ user: req.user._id }).populate(
      'items.product',
      'name price comparePrice inStock stock'
    );

    if (!wishlist || wishlist.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Wishlist is empty' });
    }

    const Cart = require('../models/Cart.model');
    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) cart = new Cart({ userId: req.user._id, items: [] });

    const skipped = [];
    for (const wi of wishlist.items) {
      const prod = wi.product;
      if (!prod || !prod.inStock) {
        skipped.push(prod?.name || 'Unknown');
        continue;
      }
      const exists = cart.items.find((ci) => ci.productId?.equals(prod._id));
      if (!exists) {
        cart.items.push({
          productId: prod._id,
          qty: 1,
          variantSku: 'default',
          price: prod.price ?? 0,
        });
      }
    }

    await cart.save();
    wishlist.items = [];
    await wishlist.save();

    return res.status(200).json({
      success: true,
      message: skipped.length
        ? `Items moved to cart. Skipped out-of-stock: ${skipped.join(', ')}`
        : 'All items moved to cart',
      data: { skipped },
    });
  } catch (err) {
    console.error('[Wishlist] moveAllToCart error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getWishlist,
  addItem,
  removeItem,
  toggleItem,
  clearWishlist,
  checkItem,
  moveAllToCart,
};
