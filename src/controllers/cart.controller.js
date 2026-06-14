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
    throw new ApiError(400, 'Missing session id for guest cart. Send "x-session-id" header.');
  }
  return { sessionId };
};

const findOrCreateCart = async (req) => {
  const filter = cartOwnerFilter(req);
  let cart = await Cart.findOne(filter);
  if (!cart) {
    cart = await Cart.create(filter);
  }
  return cart;
};

const resolveLineItem = async (productId, variantSku) => {
  const product = await Product.findById(productId);
  if (!product || !product.isActive || product.status !== 'active') {
    throw new ApiError(404, 'Product not found or unavailable.');
  }

  if (!variantSku || variantSku === 'default' || variantSku === '') {
    return {
      productId: product._id,
      variantSku: 'default',
      price: product.effectivePrice ?? product.price,
      stock: product.trackInventory ? product.stock : Infinity,
      name: product.name,
      image: product.images?.[0]?.url || '',
      variantTitle: null,
      slug: product.slug,
    };
  }

  let variant = await ProductVariant.findOne({
    product: product._id,
    sku: variantSku,
    isActive: true,
  });

  if (!variant) {
    const embedded = (product.variants || []).find((v) => v.sku === variantSku);
    if (!embedded) {
      throw new ApiError(404, 'Selected variant not found.');
    }
    return {
      productId: product._id,
      variantSku: embedded.sku,
      price: embedded.price,
      stock: embedded.stock,
      name: product.name,
      image: product.images?.[0]?.url || '',
      variantTitle: null,
      slug: product.slug,
    };
  }

  return {
    productId: product._id,
    variantSku: variant.sku,
    price: variant.price,
    stock: variant.stock,
    name: product.name,
    image: variant.image || product.images?.[0]?.url || '',
    variantTitle: variant.variantTitle,
    slug: product.slug,
  };
};

const serializeCart = async (cart) => {
  const productIds = [...new Set(cart.items.map((i) => String(i.productId)))];
  const products = await Product.find({ _id: { $in: productIds } })
    .select('name slug images price comparePrice stock trackInventory isActive status variants');

  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const items = cart.items.map((item) => {
    const product = productMap.get(String(item.productId));

    let variantInfo = null;
    let liveStock = product?.trackInventory ? product?.stock : Infinity;
    let livePrice = product?.effectivePrice ?? product?.price ?? item.price;

    if (product && item.variantSku !== 'default') {
      const embedded = (product.variants || []).find((v) => v.sku === item.variantSku);
      if (embedded) {
        variantInfo = { sku: embedded.sku, attrs: embedded.attrs };
        liveStock = embedded.stock;
        livePrice = embedded.price;
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
            id:    product._id,
            name:  product.name,
            slug:  product.slug,
            image: product.images?.[0]?.url || '',
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
  return ApiResponse.success(res, data, 'Cart fetched successfully');
});

/* ════════════════════════════════════════════════════════════
   POST /api/cart/items
════════════════════════════════════════════════════════════ */
exports.addItem = catchAsync(async (req, res) => {
  const { productId, variantSku = 'default', qty = 1 } = req.body;

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
  } else {
    cart.items.push({
      productId:  lineItem.productId,
      variantSku: lineItem.variantSku,
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
  const { qty, variantSku = 'default' } = req.body;

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