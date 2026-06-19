/**
 * 📁 src/controllers/wishlistController.js
 *
 * FIX: addItem / removeItem / toggleItem ekhon atomic update use kore —
 *  • `findOneAndUpdate` + `$addToSet` / `$pull` + `upsert: true`
 *  • items array kokhono lost hobe na, race condition o hobe na
 *  • serialize() ekhon non-populated items o tolerate kore
 *  • details log + clear 4xx error jate frontend e shathe shathe dhora poRe
 */

const mongoose = require('mongoose');
const WishlistModel = require('../models/WishlistModel');

/* ── helpers ─────────────────────────────────────────────────── */
const toId = (id) => new mongoose.Types.ObjectId(String(id));

const populateItems = (doc) =>
  doc.populate({
    path: 'items.product',
    select:
      'name slug images price comparePrice avgRating reviewCount brand inStock stock isActive',
    populate: { path: 'brand', select: 'name logo' },
  });

/**
 * Serialize wishlist for client.
 * - Populated items: drop only if product is explicitly inactive.
 * - Non-populated items (raw ObjectId): keep as-is so the client still gets
 *   the productId. Frontend never loses the heart state.
 */
const serialize = (wishlist) => {
  const items = (wishlist.items || []).filter((i) => {
    if (!i.product) return false;
    // populated doc with isActive flag
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

const validateProductId = (productId, res) => {
  if (!productId || !mongoose.isValidObjectId(productId)) {
    res
      .status(400)
      .json({ success: false, message: 'Invalid or missing productId', received: productId });
    return false;
  }
  return true;
};

/* ── GET /api/wishlist ───────────────────────────────────────── */
const getWishlist = async (req, res) => {
  try {
    let wishlist = await WishlistModel.findOneAndUpdate(
      { user: req.user._id },
      { $setOnInsert: { user: req.user._id, items: [] } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    await populateItems(wishlist);
    return res.status(200).json({ success: true, data: serialize(wishlist) });
  } catch (err) {
    console.error('[Wishlist] getWishlist error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ── POST /api/wishlist/items ────────────────────────────────── */
const addItem = async (req, res) => {
    console.log("hello");
//   try {
//     const productId = req.body?.productId;
//     if (!validateProductId(productId, res)) return;

//     const pid = toId(productId);

//     // Atomic upsert + addToSet on the product field only — duplicates
//     // automatically prevented, items array kokhono overwrite hobe na.
//     const wishlist = await WishlistModel.findOneAndUpdate(
//       { user: req.user._id },
//       {
//         $setOnInsert: { user: req.user._id },
//         $addToSet: { items: { product: pid, addedAt: new Date() } },
//       },
//       { new: true, upsert: true, setDefaultsOnInsert: true }
//     );

//     await populateItems(wishlist);
//     return res.status(200).json({
//       success: true,
//       message: 'Added to wishlist',
//       action: 'added',
//       data: serialize(wishlist),
//     });
//   } catch (err) {
//     console.error('[Wishlist] addItem error:', err, 'body:', req.body);
//     return res.status(500).json({ success: false, message: 'Server error' });
//   }
};

/* ── DELETE /api/wishlist/items/:productId ───────────────────── */
const removeItem = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!validateProductId(productId, res)) return;

    const pid = toId(productId);

    const wishlist = await WishlistModel.findOneAndUpdate(
      { user: req.user._id },
      {
        $setOnInsert: { user: req.user._id },
        $pull: { items: { product: pid } },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
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
    const productId = req.body?.productId;
    if (!validateProductId(productId, res)) return;

    const pid = toId(productId);

    // Step 1: pull (idempotent remove)
    const after = await WishlistModel.findOneAndUpdate(
      { user: req.user._id },
      {
        $setOnInsert: { user: req.user._id },
        $pull: { items: { product: pid } },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Determine if the item existed before (compare lengths via re-query)
    const before = await WishlistModel.findOne({ user: req.user._id }).lean();
    const wasRemoved = (before?.items || []).every(
      (i) => i.product?.toString() !== String(pid)
    )
      ? false // not present before either — so this is an "add"
      : true;

    let wishlist = after;
    let action = 'removed';

    if (!wasRemoved) {
      wishlist = await WishlistModel.findOneAndUpdate(
        { user: req.user._id },
        { $addToSet: { items: { product: pid, addedAt: new Date() } } },
        { new: true }
      );
      action = 'added';
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
      { upsert: true }
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
    const { productId } = req.params;
    if (!validateProductId(productId, res)) return;
    const wishlist = await WishlistModel.findOne({ user: req.user._id }).lean();
    const inWishlist = wishlist
      ? wishlist.items.some((i) => i.product?.toString() === String(productId))
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
      'name price inStock stock'
    );

    if (!wishlist || wishlist.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Wishlist is empty' });
    }

    const Cart = require('../models/Cart');

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });

    const skipped = [];
    for (const wi of wishlist.items) {
      const prod = wi.product;
      if (!prod || !prod.inStock) {
        skipped.push(prod?.name || 'Unknown');
        continue;
      }
      const exists = cart.items.find((ci) => ci.productId?.equals(prod._id));
      if (!exists) {
        cart.items.push({ productId: prod._id, qty: 1, variantSku: 'default' });
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
