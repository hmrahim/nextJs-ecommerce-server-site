'use strict';

const Cart           = require('../models/Cart.model');
const Product        = require('../models/ProductModel');
const ProductVariant = require('../models/ProductVariantModel');
const { ApiResponse, ApiError } = require('../utils/apiHelpers');
const catchAsync     = require('../utils/catchAsync');

/* ════════════════════════════════════════════════════════════
   Helpers
════════════════════════════════════════════════════════════ */

const cartOwnerFilter = (req) => {
  if (req.user) return { userId: req.user._id };

  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
  if (!sessionId) {
    // Auto-generate a guest sessionId and attach it so the request can proceed.
    // The response header will carry it back so the frontend can persist it.
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    req.guestSessionId = guestId;
    return { sessionId: guestId };
  }
  return { sessionId };
};

const findOrCreateCart = async (req) => {
  const filter = cartOwnerFilter(req);
  const cart = await Cart.findOneAndUpdate(
    filter,
    { $setOnInsert: { ...filter, items: [], expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return cart;
};

/**
 * Convert variant attrs array (e.g. [{attributeName:'Color', valueLabel:'Red'}])
 * to a plain object: { Color: 'Red' }
 */
const attrsArrayToObject = (attrs) => {
  if (!Array.isArray(attrs)) return attrs || {};
  const out = {};
  for (const a of attrs) {
    const key = a.attributeName || a.name || a.key;
    const val = a.valueLabel ?? a.value ?? a.label;
    if (key) out[key] = val;
  }
  return out;
};

const resolveLineItem = async (productId, variantSku) => {
  const product = await Product.findById(productId);
  if (!product || !product.isActive || product.status !== 'active') {
    throw new ApiError(404, 'Product not found or unavailable.');
  }

  const isDefault = !variantSku || variantSku === 'default' || variantSku === '';

  // If a real variantSku was provided, resolve it from either source.
  if (!isDefault) {
    // variantSku may be a MongoDB _id string if the variant has no sku field
    const isObjectId = /^[a-f\d]{24}$/i.test(variantSku);
    const variantQuery = isObjectId
      ? { _id: variantSku, product: product._id, isActive: true }
      : { product: product._id, sku: variantSku, isActive: true };

    const variant = await ProductVariant.findOne(variantQuery);

    if (variant) {
      return {
        productId: product._id,
        variantSku: variant.sku || String(variant._id),   // ← FIX: sku না থাকলে _id ব্যবহার করো
        price: variant.price,
        stock: variant.stock,
        name: product.name,
        image: variant.image?.url || variant.image || product.images?.[0]?.url || '',
        variantTitle: variant.variantTitle,
        variantAttrs: attrsArrayToObject(variant.attributes),
        slug: product.slug,
      };
    }

    const embedded = (product.variants || []).find((v) => v.sku === variantSku);
    if (embedded) {
      // embedded.attrs is a plain object { Color: 'Red', Size: 'S' }
      const attrs = embedded.attrs instanceof Map
        ? Object.fromEntries(embedded.attrs)
        : (embedded.attrs || {});
      return {
        productId: product._id,
        variantSku: embedded.sku,
        price: embedded.price,
        stock: embedded.stock ?? 0,
        name: product.name,
        image: product.images?.[0]?.url || '',
        variantTitle: embedded.variantTitle || null,
        variantAttrs: attrs,
        slug: product.slug,
      };
    }
    // Unknown SKU — fall through and treat as default rather than blocking the user.
  }

  // No variantSku provided. If the product has variants, fall back to the first
  // active one so the order still carries variantAttrs (no more null attrs).
  const externalVariant = await ProductVariant.findOne({
    product: product._id,
    isActive: true,
  }).sort({ createdAt: 1 });

  if (externalVariant) {
    return {
      productId: product._id,
      variantSku: externalVariant.sku || 'default',
      price: externalVariant.price,
      stock: externalVariant.stock,
      name: product.name,
      image: externalVariant.image?.url || externalVariant.image || product.images?.[0]?.url || '',
      variantTitle: externalVariant.variantTitle,
      variantAttrs: attrsArrayToObject(externalVariant.attributes),
      slug: product.slug,
    };
  }

  const embeddedFirst = Array.isArray(product.variants) && product.variants.length > 0
    ? product.variants[0]
    : null;

  if (embeddedFirst) {
    return {
      productId: product._id,
      variantSku: embeddedFirst.sku || 'default',
      price: embeddedFirst.price ?? product.price,
      stock: embeddedFirst.stock ?? (product.trackInventory ? product.stock : Infinity),
      name: product.name,
      image: product.images?.[0]?.url || '',
      variantTitle: embeddedFirst.variantTitle || null,
      variantAttrs: attrsArrayToObject(embeddedFirst.attrs || embeddedFirst.attributes),
      slug: product.slug,
    };
  }

  // True variant-less product.
  return {
    productId: product._id,
    variantSku: 'default',
    price: product.effectivePrice ?? product.price,
    stock: product.trackInventory ? product.stock : Infinity,
    name: product.name,
    image: product.images?.[0]?.url || '',
    variantTitle: null,
    variantAttrs: null,
    slug: product.slug,
  };
};


const serializeCart = async (cart) => {
  const productIds = [...new Set(cart.items.map((i) => String(i.productId)))];
  const products = await Product.find({ _id: { $in: productIds } })
    .select('name slug images price comparePrice stock trackInventory isActive status variants');

  const productMap = new Map(products.map((p) => [String(p._id), p]));

  // Pre-load all referenced variants from the separate collection.
  const variantSkus = cart.items
    .filter((i) => i.variantSku && i.variantSku !== 'default')
    .map((i) => ({ product: i.productId, sku: i.variantSku }));

  let externalVariants = [];
  if (variantSkus.length) {
    // variantSku may be a MongoDB _id (24-char hex) or a real sku string
    const byIdList = variantSkus.filter(v => /^[a-f\d]{24}$/i.test(v.sku)).map(v => v.sku);
    const bySku    = variantSkus.filter(v => !/^[a-f\d]{24}$/i.test(v.sku));
    const orQuery  = [];
    if (byIdList.length) orQuery.push({ _id: { $in: byIdList } });
    if (bySku.length)    orQuery.push(...bySku.map(v => ({ product: v.product, sku: v.sku })));
    if (orQuery.length) externalVariants = await ProductVariant.find({ $or: orQuery });
  }
  const variantMap = new Map();
  for (const v of externalVariants) {
    // sku দিয়ে key বানাও (থাকলে), নইলে _id দিয়ে — দুটোই রাখো যাতে দুই format-ই match করে
    if (v.sku) variantMap.set(`${String(v.product)}__${v.sku}`, v);
    variantMap.set(`${String(v.product)}__${String(v._id)}`, v);
  }

  const items = cart.items.map((item) => {
    const product = productMap.get(String(item.productId));

    let variantInfo = null;
    let liveStock = product?.trackInventory ? product?.stock : Infinity;
    let livePrice = product?.effectivePrice ?? product?.price ?? item.price;

    if (product && item.variantSku && item.variantSku !== 'default') {
      // Prefer external ProductVariant doc.
      const ext = variantMap.get(`${String(item.productId)}__${item.variantSku}`);
      if (ext) {
        variantInfo = {
          sku:   ext.sku,
          title: ext.variantTitle || null,
          attrs: attrsArrayToObject(ext.attributes),
          image: ext.image?.url || ext.image || null,
        };
        liveStock = ext.stock;
        livePrice = ext.price;
      } else {
        const embedded = (product.variants || []).find((v) => v.sku === item.variantSku);
        if (embedded) {
          variantInfo = {
            sku:   embedded.sku,
            title: embedded.variantTitle || null,
            attrs: attrsArrayToObject(embedded.attrs || embedded.attributes),
            image: null,
          };
          liveStock = embedded.stock;
          livePrice = embedded.price;
        }
      }
    }

    return {
      productId:    item.productId,
      variantSku:   item.variantSku,
      qty:          item.qty,
      price:        item.price,
      currentPrice: livePrice,
      lineTotal:    item.price * item.qty,
      stock:        liveStock,
      inStock:      liveStock === Infinity || liveStock >= item.qty,
      product: product
        ? {
            id:       product._id,
            name:     product.name,
            slug:     product.slug,
            image:    variantInfo?.image || product.images?.[0]?.url || '',
            isActive: product.isActive,
            status:   product.status,
          }
        : null,
      variant: variantInfo,
    };
  });

  return {
    _id:       cart._id,
    userId:    cart.userId,
    sessionId: cart.sessionId,
    items,
    itemCount: items.reduce((sum, i) => sum + i.qty, 0),
    total:     items.reduce((sum, i) => sum + i.lineTotal, 0),
    updatedAt: cart.updatedAt,
  };
};

/* ════════════════════════════════════════════════════════════
   GET /api/cart
════════════════════════════════════════════════════════════ */
exports.getCart = catchAsync(async (req, res) => {
  const cart = await findOrCreateCart(req);
  const data = await serializeCart(cart);
  if (req.guestSessionId) {
    res.setHeader('x-session-id', req.guestSessionId);
    data.sessionId = req.guestSessionId;
  }
  return ApiResponse.success(res, data, 'Cart fetched successfully');
});

/* ════════════════════════════════════════════════════════════
   POST /api/cart/items
════════════════════════════════════════════════════════════ */
exports.addItem = catchAsync(async (req, res) => {
  // qty is already coerced to int by validator (.toInt())
  const qty = Number(req.body.qty ?? 1);

  // Accept variant sku in multiple shapes from the frontend.
  const variantSku =
    req.body.variantSku ||
    req.body.sku ||
    req.body.variant?.sku ||
    req.body.variant?.variantSku ||
    'default';

  const { productId } = req.body;

  if (!productId) throw new ApiError(400, 'productId is required.');
  if (!Number.isInteger(qty) || qty < 1) {
    throw new ApiError(400, 'qty must be a positive integer.');
  }

  const lineItem = await resolveLineItem(productId, variantSku);

  const cart = await findOrCreateCart(req);
  const existing = cart.items.find(
    (i) => String(i.productId) === String(lineItem.productId) && i.variantSku === lineItem.variantSku
  );

  const newQty = (existing?.qty || 0) + qty;

  if (lineItem.stock !== Infinity && newQty > lineItem.stock) {
    throw new ApiError(409, `Only ${lineItem.stock} item(s) left in stock.`);
  }

  if (existing) {
    existing.qty = newQty;
    existing.price = lineItem.price;
    existing.variantSku = existing.variantSku || lineItem.variantSku || 'default';
  } else {
    cart.items.push({
      productId:  lineItem.productId,
      variantSku: lineItem.variantSku || 'default',
      qty,
      price: lineItem.price,
    });
  }

  cart.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await cart.save();

  const data = await serializeCart(cart);
  return ApiResponse.success(res, data, 'Item added to cart', 201);
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/cart/items/:productId
════════════════════════════════════════════════════════════ */
exports.updateItem = catchAsync(async (req, res) => {
  const { productId } = req.params;
  // qty is already coerced to int by validator (.toInt())
  const qty = Number(req.body.qty);
  const variantSku = req.body.variantSku || 'default';

  if (!Number.isInteger(qty) || qty < 1) {
    throw new ApiError(400, 'qty must be a positive integer.');
  }

  const cart = await findOrCreateCart(req);
  const item = cart.items.find(
    (i) => String(i.productId) === String(productId) && i.variantSku === variantSku
  );

  if (!item) throw new ApiError(404, 'Item not found in cart.');

  const lineItem = await resolveLineItem(productId, variantSku);
  if (lineItem.stock !== Infinity && qty > lineItem.stock) {
    throw new ApiError(409, `Only ${lineItem.stock} item(s) left in stock.`);
  }

  item.qty = qty;
  item.price = lineItem.price;

  await cart.save();
  const data = await serializeCart(cart);
  return ApiResponse.success(res, data, 'Cart item updated');
});

/* ════════════════════════════════════════════════════════════
   DELETE /api/cart/items/:productId
════════════════════════════════════════════════════════════ */
exports.removeItem = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const variantSku = req.body?.variantSku || req.query?.variantSku || 'default';

  const cart = await findOrCreateCart(req);
  const before = cart.items.length;

  cart.items = cart.items.filter(
    (i) => !(String(i.productId) === String(productId) && i.variantSku === variantSku)
  );

  if (cart.items.length === before) {
    throw new ApiError(404, 'Item not found in cart.');
  }

  await cart.save();
  const data = await serializeCart(cart);
  return ApiResponse.success(res, data, 'Item removed from cart');
});

/* ════════════════════════════════════════════════════════════
   DELETE /api/cart
════════════════════════════════════════════════════════════ */
exports.clearCart = catchAsync(async (req, res) => {
  const cart = await findOrCreateCart(req);
  cart.items = [];
  await cart.save();

  const data = await serializeCart(cart);
  return ApiResponse.success(res, data, 'Cart cleared');
});

/* ════════════════════════════════════════════════════════════
   POST /api/cart/merge
════════════════════════════════════════════════════════════ */
exports.mergeCart = catchAsync(async (req, res) => {
  if (!req.user) throw new ApiError(401, 'Not authenticated.');

  const { sessionId } = req.body;
  if (!sessionId) throw new ApiError(400, 'sessionId is required.');

  const guestCart = await Cart.findOne({ sessionId });
  const userCart  = await findOrCreateCart(req);

  if (guestCart && guestCart.items.length) {
    for (const gItem of guestCart.items) {
      const existing = userCart.items.find(
        (i) => String(i.productId) === String(gItem.productId) && i.variantSku === gItem.variantSku
      );
      if (existing) {
        existing.qty += gItem.qty;
        existing.price = gItem.price;
      } else {
        userCart.items.push({
          productId:  gItem.productId,
          variantSku: gItem.variantSku,
          qty:        gItem.qty,
          price:      gItem.price,
        });
      }
    }
    await userCart.save();
    await Cart.deleteOne({ _id: guestCart._id });
  }

  const data = await serializeCart(userCart);
  return ApiResponse.success(res, data, 'Cart merged successfully');
});