/**
 * 📁 controllers/orderController.js
 *
 * Amazon/Noon-style order flow with rider assignment & COD/online payment.
 *
 * Client:
 *   POST   /api/orders                       → createOrder
 *   GET    /api/orders/my                    → getMyOrders
 *   GET    /api/orders/:id                   → getOrderById
 *   PATCH  /api/orders/:id/cancel            → cancelOrder
 *
 * Admin:
 *   GET    /api/admin/orders                 → adminGetAll
 *   GET    /api/admin/orders/export          → adminExport
 *   GET    /api/admin/orders/stats           → adminStats
 *   GET    /api/admin/orders/riders          → adminListRiders
 *   GET    /api/admin/orders/:id             → adminGetById
 *   PATCH  /api/admin/orders/:id/confirm     → adminConfirmOrder (REQUIRES riderId)
 *   PATCH  /api/admin/orders/:id/assign-rider→ adminAssignRider  (reassign)
 *   PATCH  /api/admin/orders/:id/status      → adminUpdateStatus
 *   PATCH  /api/admin/orders/:id/cancel      → adminCancelOrder
 *
 * Rider:
 *   GET    /api/rider/orders                 → riderListOrders
 *   GET    /api/rider/orders/:id             → riderGetOrder
 *   PATCH  /api/rider/orders/:id/pickup      → riderMarkPickedUp   (status = shipped)
 *   PATCH  /api/rider/orders/:id/deliver     → riderCompleteDelivery (status = delivered + collects payment)
 */

const mongoose = require('mongoose');
const Order   = require('../models/OrderModel');
const User    = require('../models/User');
const Cart    = require('../models/Cart.model');
const Product = require('../models/ProductModel');
const Coupon  = require('../models/CouponModel');
const { broadcast } = require('../utils/sseManager');
const { emitChange } = require('../utils/socket');

/* ═══════════════ HELPERS ═══════════════ */

const paginate = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, parseInt(query.limit) || 12);
  return { page, limit, skip: (page - 1) * limit };
};

const buildSort = (sortStr = 'createdAt:desc') => {
  const [field, dir] = sortStr.split(':');
  const allowed = ['createdAt', 'placedAt', 'total', 'status', 'orderNumber'];
  const key = allowed.includes(field) ? field : 'createdAt';
  return { [key]: dir === 'asc' ? 1 : -1 };
};

const decorate = (o) => ({
  ...o,
  customerName:  `${o.userId?.firstName || ''} ${o.userId?.lastName || ''}`.trim() || 'Guest',
  customerEmail: o.userId?.email || '—',
  customerPhone: o.shippingAddress?.phone || '—',
  totalAmount:   o.total,
  placedAt:      o.placedAt || o.createdAt,
});

/* ── Realtime broadcast helper — order create/update হলে admin dashboard
   কে instant notify করে (Socket.IO প্রাইমারি, SSE legacy fallback) ── */
const emitOrderEvent = (event, order, extra = {}) => {
  const payload = {
    _id:         order._id,
    orderNumber: order.orderNumber,
    status:      order.status,
    totalAmount: order.total,
    customerName: order.shippingAddress
      ? `${order.shippingAddress.firstName || ''} ${order.shippingAddress.lastName || ''}`.trim()
      : undefined,
    placedAt:    order.placedAt || order.createdAt,
    items:       order.items?.length,
    ...extra,
  };

  // 🔌 Socket.IO — admins room এ broadcast (dashboard/orders page realtime UI)
  const action = event === 'order_created' ? 'create' : 'update';
  emitChange('Order', action, { id: order._id, doc: payload });

  // 🔔 Legacy SSE fallback (যদি কোথাও এখনো SSE listen করে)
  broadcast('orders', event, payload);
};

/* ═══════════════ CLIENT — CREATE ORDER ═══════════════ */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      items, shippingAddress, deliveryMethod, paymentMethod,
      couponCode,
    } = req.body;

    if (!items?.length)    return res.status(400).json({ message: 'Cart empty — no items' });
    if (!shippingAddress)  return res.status(400).json({ message: 'Shipping address is required' });
    if (!shippingAddress.firstName || !shippingAddress.lastName || !shippingAddress.phone) {
      return res.status(400).json({ message: 'Name and phone are required in shipping address' });
    }
    if (!shippingAddress.lat || !shippingAddress.lng) {
      return res.status(400).json({ message: 'Map location (lat/lng) is required' });
    }

    /* Verify stock & re-calc */
    let serverSubtotal = 0;
    const verifiedItems = [];
    for (const item of items) {
      const product = await Product.findById(item.productId).lean();
      if (!product || !product.isActive) {
        return res.status(409).json({ message: `"${item.productName}" আর পাওয়া যাচ্ছে না।` });
      }
      let currentStock = product.stock ?? 0;
      let currentPrice = product.price;
      if (item.variantSku && item.variantSku !== 'default') {
        const variant = (product.variants || []).find((v) => v.sku === item.variantSku);
        if (!variant) return res.status(409).json({ message: `Variant পাওয়া যাচ্ছে না।` });
        currentStock = variant.stock ?? 0;
        currentPrice = variant.price ?? product.price;
      }
      if (currentStock < item.quantity) {
        return res.status(409).json({ message: `"${item.productName}" এ মাত্র ${currentStock}টি available।` });
      }
      const lineTotal = currentPrice * item.quantity;
      serverSubtotal += lineTotal;
      verifiedItems.push({
        productId:    item.productId,
        variantSku:   item.variantSku || 'default',
        productName:  product.name,
        productImage: product.images?.[0]?.url || product.image || '',
        variantAttrs: item.variantAttrs ?? null,
        quantity:     item.quantity,
        unitPrice:    currentPrice,
        lineTotal,
      });
    }

    /* Coupon */
    let serverCouponDiscount = 0;
    let freeShipCoupon = false;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true }).lean();
      if (coupon) {
        if (coupon.type === 'percent')      serverCouponDiscount = Math.round(serverSubtotal * (coupon.value / 100));
        else if (coupon.type === 'fixed')   serverCouponDiscount = Math.min(coupon.value, serverSubtotal);
        else if (coupon.type === 'shipping') freeShipCoupon = true;
        await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
      }
    }

    const FREE_SHIP_THRESHOLD = 999;
    const DELIVERY_COST = { standard: 0, express: 120, sameday: 200 };
    const freeShip = freeShipCoupon || serverSubtotal >= FREE_SHIP_THRESHOLD;
    const serverShippingCost = freeShip ? 0 : (DELIVERY_COST[deliveryMethod] ?? 0);
    const serverTotal = Math.max(0, serverSubtotal + serverShippingCost - serverCouponDiscount);

    const order = await Order.create({
      userId,
      items:          verifiedItems,
      shippingAddress,
      deliveryMethod: deliveryMethod || 'standard',
      paymentMethod,
      paymentStatus:  'pending',
      subtotal:       serverSubtotal,
      shippingCost:   serverShippingCost,
      couponCode:     couponCode || null,
      couponDiscount: serverCouponDiscount,
      total:          serverTotal,
    });

    /* Decrement stock */
    for (const item of verifiedItems) {
      if (item.variantSku !== 'default') {
        await Product.updateOne(
          { _id: item.productId, 'variants.sku': item.variantSku },
          { $inc: { 'variants.$.stock': -item.quantity } }
        );
      } else {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
      }
    }

    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    // 🔔 Realtime: notify admin dashboard about the new order
    emitOrderEvent('order_created', order);

    return res.status(201).json({ message: 'Order placed successfully', data: order });
  } catch (err) {
    console.error('[createOrder]', err);
    return res.status(500).json({ message: 'Server error while placing order' });
  }
};

/* ═══════════════ CLIENT — GET MY ORDERS ═══════════════ */
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page, limit, skip } = paginate(req.query);
    const filter = { userId };
    if (req.query.status) filter.status = req.query.status;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-__v').lean(),
      Order.countDocuments(filter),
    ]);
    return res.json({ data: orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[getMyOrders]', err);
    return res.status(500).json({ message: 'Could not fetch orders' });
  }
};

/* ═══════════════ CLIENT — GET SINGLE ORDER ═══════════════ */
exports.getOrderById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id, userId }
      : { orderNumber: id, userId };
    const order = await Order.findOne(query).lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json({ data: order });
  } catch (err) {
    console.error('[getOrderById]', err);
    return res.status(500).json({ message: 'Could not fetch order' });
  }
};

/* ═══════════════ CLIENT — CANCEL ═══════════════ */
exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const order  = await Order.findOne({ _id: req.params.id, userId });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ message: `"${order.status}" status এ order cancel করা যাবে না।` });
    }
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.statusHistory.push({ status: 'cancelled', note: 'Cancelled by customer', changedBy: userId });
    await order.save();

    // restore stock & free up rider
    for (const item of order.items) {
      if (item.variantSku !== 'default') {
        await Product.updateOne(
          { _id: item.productId, 'variants.sku': item.variantSku },
          { $inc: { 'variants.$.stock': item.quantity } }
        );
      } else {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
      }
    }
    if (order.rider?.riderId) {
      await User.findByIdAndUpdate(order.rider.riderId, { $inc: { 'riderProfile.activeOrders': -1 } });
    }

    emitOrderEvent('order_updated', order);

    return res.json({ message: 'Order cancelled', data: order });
  } catch (err) {
    console.error('[cancelOrder]', err);
    return res.status(500).json({ message: 'Could not cancel order' });
  }
};

/* ═══════════════ ADMIN — STATS ═══════════════ */
exports.adminStats = async (_req, res) => {
  try {
    const [total, pending, confirmed, shipped, delivered, cancelled, revenueAgg] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'confirmed' }),
      Order.countDocuments({ status: 'shipped' }),
      Order.countDocuments({ status: 'delivered' }),
      Order.countDocuments({ status: 'cancelled' }),
      Order.aggregate([
        { $match: { status: { $in: ['delivered', 'shipped'] } } },
        { $group: { _id: null, sum: { $sum: '$total' } } },
      ]),
    ]);
    return res.json({
      data: {
        total, pending, confirmed, shipped, delivered, cancelled,
        revenue: revenueAgg[0]?.sum || 0,
      },
    });
  } catch (err) {
    console.error('[adminStats]', err);
    return res.status(500).json({ message: 'Could not fetch stats' });
  }
};

/* ═══════════════ ADMIN — LIST RIDERS ═══════════════ */
exports.adminListRiders = async (req, res) => {
  try {
    const filter = { role: 'rider', isActive: true };
    if (req.query.area) filter['riderProfile.serviceAreas'] = req.query.area;
    if (req.query.availableOnly === 'true') filter['riderProfile.isAvailable'] = true;

    const riders = await User.find(filter)
      .select('firstName lastName email phone avatar riderProfile')
      .sort({ 'riderProfile.activeOrders': 1, 'riderProfile.rating': -1 })
      .lean();

    const data = riders.map((r) => ({
      _id:         r._id,
      name:        `${r.firstName} ${r.lastName}`.trim(),
      email:       r.email,
      phone:       r.phone,
      avatar:      r.avatar,
      vehicleType: r.riderProfile?.vehicleType || 'bike',
      serviceAreas: r.riderProfile?.serviceAreas || [],
      isAvailable: r.riderProfile?.isAvailable ?? true,
      activeOrders: r.riderProfile?.activeOrders || 0,
      completedOrders: r.riderProfile?.completedOrders || 0,
      rating:      r.riderProfile?.rating ?? 5,
    }));
    return res.json({ data });
  } catch (err) {
    console.error('[adminListRiders]', err);
    return res.status(500).json({ message: 'Could not list riders' });
  }
};

/* ═══════════════ ADMIN — GET ALL ═══════════════ */
exports.adminGetAll = async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const sort = buildSort(req.query.sort);
    const filter = {};
    if (req.query.status)        filter.status = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.riderId)       filter['rider.riderId'] = req.query.riderId;
    if (req.query.unassigned === 'true') filter['rider.riderId'] = null;

    if (req.query.search) {
      const s = req.query.search.trim();
      filter.$or = [
        { orderNumber: { $regex: s, $options: 'i' } },
        { 'shippingAddress.firstName': { $regex: s, $options: 'i' } },
        { 'shippingAddress.lastName':  { $regex: s, $options: 'i' } },
        { 'shippingAddress.phone':     { $regex: s, $options: 'i' } },
        { 'rider.riderName':           { $regex: s, $options: 'i' } },
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(limit)
        .populate('userId', 'firstName lastName email phone')
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.json({
      orders:     orders.map(decorate),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      total,
      pages:      Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[adminGetAll]', err);
    return res.status(500).json({ message: 'Could not fetch orders' });
  }
};

/* ═══════════════ ADMIN — GET ONE ═══════════════ */
exports.adminGetById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('userId', 'firstName lastName email phone')
      .populate('rider.riderId', 'firstName lastName email phone avatar riderProfile')
      .lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json({ data: decorate(order) });
  } catch (err) {
    console.error('[adminGetById]', err);
    return res.status(500).json({ message: 'Could not fetch order' });
  }
};

/* ═══════════════ ADMIN — CONFIRM ORDER (rider required) ═══════════════ */
/**
 * PATCH /api/admin/orders/:id/confirm
 * Body: { riderId, note? }
 *
 * Pending → Confirmed + Rider assigned in one step (Amazon/Noon style).
 */
exports.adminConfirmOrder = async (req, res) => {
  try {
    const { riderId, note } = req.body;
    if (!riderId) {
      return res.status(400).json({ message: 'Rider অবশ্যই select করতে হবে confirm করার আগে।' });
    }

    const rider = await User.findOne({ _id: riderId, role: 'rider', isActive: true });
    if (!rider) return res.status(404).json({ message: 'Selected rider not found / inactive' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status !== 'pending') {
      return res.status(400).json({ message: `Only pending orders can be confirmed. Current: ${order.status}` });
    }

    order.status      = 'confirmed';
    order.confirmedAt = new Date();
    order.rider = {
      riderId:     rider._id,
      riderName:   `${rider.firstName} ${rider.lastName}`.trim(),
      riderPhone:  rider.phone,
      vehicleType: rider.riderProfile?.vehicleType || 'bike',
      assignedAt:  new Date(),
      assignedBy:  req.user._id,
      note:        note || null,
    };
    order.statusHistory.push({
      status: 'confirmed',
      note:   note ? `Confirmed & assigned to ${order.rider.riderName}. ${note}` : `Confirmed & assigned to ${order.rider.riderName}`,
      changedBy: req.user._id,
    });

    await order.save();
    await User.findByIdAndUpdate(rider._id, { $inc: { 'riderProfile.activeOrders': 1 } });

    emitOrderEvent('order_updated', order);

    return res.json({ message: 'Order confirmed & rider assigned', data: order });
  } catch (err) {
    console.error('[adminConfirmOrder]', err);
    return res.status(500).json({ message: 'Could not confirm order' });
  }
};

/* ═══════════════ ADMIN — REASSIGN RIDER ═══════════════ */
exports.adminAssignRider = async (req, res) => {
  try {
    const { riderId, note } = req.body;
    if (!riderId) return res.status(400).json({ message: 'riderId required' });

    const rider = await User.findOne({ _id: riderId, role: 'rider', isActive: true });
    if (!rider) return res.status(404).json({ message: 'Rider not found' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!['confirmed', 'shipped'].includes(order.status)) {
      return res.status(400).json({ message: 'Rider reassign only allowed for confirmed/shipped orders' });
    }

    // decrement old rider's active count
    if (order.rider?.riderId && String(order.rider.riderId) !== String(rider._id)) {
      await User.findByIdAndUpdate(order.rider.riderId, { $inc: { 'riderProfile.activeOrders': -1 } });
      await User.findByIdAndUpdate(rider._id, { $inc: { 'riderProfile.activeOrders': 1 } });
    }

    order.rider = {
      ...(order.rider || {}),
      riderId:     rider._id,
      riderName:   `${rider.firstName} ${rider.lastName}`.trim(),
      riderPhone:  rider.phone,
      vehicleType: rider.riderProfile?.vehicleType || 'bike',
      assignedAt:  new Date(),
      assignedBy:  req.user._id,
      note:        note || order.rider?.note || null,
    };
    order.statusHistory.push({
      status: order.status,
      note:   `Rider reassigned to ${order.rider.riderName}`,
      changedBy: req.user._id,
    });
    await order.save();
    emitOrderEvent('order_updated', order);
    return res.json({ message: 'Rider assigned', data: order });
  } catch (err) {
    console.error('[adminAssignRider]', err);
    return res.status(500).json({ message: 'Could not assign rider' });
  }
};

/* ═══════════════ ADMIN — UPDATE STATUS (generic) ═══════════════ */
exports.adminUpdateStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const allowed = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (!allowed.includes(status)) return res.status(400).json({ message: `Invalid status: ${status}` });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // guard: cannot move to confirmed without rider
    if (status === 'confirmed' && !order.rider?.riderId) {
      return res.status(400).json({ message: 'Use /confirm endpoint — rider required to confirm an order.' });
    }

    order.status = status;
    if (status === 'shipped')   order.shippedAt   = order.shippedAt   || new Date();
    if (status === 'delivered') order.deliveredAt = order.deliveredAt || new Date();
    if (status === 'cancelled') order.cancelledAt = new Date();

    order.statusHistory.push({ status, note: note || '', changedBy: req.user._id });

    if (status === 'delivered' && order.paymentMethod === 'cod') {
      order.paymentStatus = 'paid';
    }
    if (status === 'refunded') order.paymentStatus = 'refunded';

    await order.save();
    emitOrderEvent('order_updated', order);
    return res.json({ message: 'Status updated', data: order });
  } catch (err) {
    console.error('[adminUpdateStatus]', err);
    return res.status(500).json({ message: 'Could not update status' });
  }
};

/* ═══════════════ ADMIN — CANCEL ═══════════════ */
exports.adminCancelOrder = async (req, res) => {
  try {
    const { note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (['delivered', 'cancelled', 'refunded'].includes(order.status)) {
      return res.status(400).json({ message: `Cannot cancel a ${order.status} order` });
    }
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.statusHistory.push({ status: 'cancelled', note: note || 'Cancelled by admin', changedBy: req.user._id });
    await order.save();

    if (order.rider?.riderId) {
      await User.findByIdAndUpdate(order.rider.riderId, { $inc: { 'riderProfile.activeOrders': -1 } });
    }
    emitOrderEvent('order_updated', order);
    return res.json({ message: 'Order cancelled', data: order });
  } catch (err) {
    console.error('[adminCancelOrder]', err);
    return res.status(500).json({ message: 'Could not cancel order' });
  }
};

/* ═══════════════ ADMIN — EXPORT CSV ═══════════════ */
exports.adminExport = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
    }
    const orders = await Order.find(filter).sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName email').lean();

    const rows = [
      ['OrderNumber', 'Customer', 'Email', 'Phone', 'Status', 'Payment', 'Rider', 'Total', 'PlacedAt'].join(','),
      ...orders.map((o) => [
        o.orderNumber,
        `${o.userId?.firstName || ''} ${o.userId?.lastName || ''}`.trim(),
        o.userId?.email || '',
        o.shippingAddress?.phone || '',
        o.status, o.paymentStatus,
        o.rider?.riderName || '',
        o.total,
        new Date(o.createdAt).toISOString(),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`);
    return res.send(rows);
  } catch (err) {
    console.error('[adminExport]', err);
    return res.status(500).json({ message: 'Could not export orders' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   RIDER ENDPOINTS — for the delivery man
═══════════════════════════════════════════════════════════════ */

/* GET /api/rider/orders?status=&page=&limit= */
exports.riderListOrders = async (req, res) => {
  try {
    const riderId = req.user._id;
    const { page, limit, skip } = paginate(req.query);
    const filter = { 'rider.riderId': riderId };
    if (req.query.status) filter.status = req.query.status;
    else filter.status = { $in: ['confirmed', 'shipped'] }; // default: active jobs

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ confirmedAt: -1, createdAt: -1 }).skip(skip).limit(limit)
        .populate('userId', 'firstName lastName email phone').lean(),
      Order.countDocuments(filter),
    ]);
    return res.json({
      data: orders.map(decorate),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[riderListOrders]', err);
    return res.status(500).json({ message: 'Could not fetch rider orders' });
  }
};

/* GET /api/rider/orders/:id */
exports.riderGetOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, 'rider.riderId': req.user._id })
      .populate('userId', 'firstName lastName email phone').lean();
    if (!order) return res.status(404).json({ message: 'Order not found / not assigned to you' });
    return res.json({ data: decorate(order) });
  } catch (err) {
    console.error('[riderGetOrder]', err);
    return res.status(500).json({ message: 'Could not fetch order' });
  }
};

/* PATCH /api/rider/orders/:id/pickup — confirmed → shipped */
exports.riderMarkPickedUp = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, 'rider.riderId': req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found / not assigned to you' });
    if (order.status !== 'confirmed') {
      return res.status(400).json({ message: `Cannot pick up — current status: ${order.status}` });
    }
    order.status = 'shipped';
    order.shippedAt = new Date();
    order.rider.pickedUpAt = new Date();
    order.statusHistory.push({
      status: 'shipped',
      note:   'Order picked up by rider — out for delivery',
      changedBy: req.user._id,
    });
    await order.save();
    emitOrderEvent('order_updated', order);
    return res.json({ message: 'Order picked up — out for delivery', data: order });
  } catch (err) {
    console.error('[riderMarkPickedUp]', err);
    return res.status(500).json({ message: 'Could not update order' });
  }
};

/* PATCH /api/rider/orders/:id/deliver — shipped → delivered (+ payment) */
/**
 * Body: {
 *   paymentMethod: 'cod' | 'bkash' | 'nagad' | 'rocket' | 'card' | 'bank' | 'online_already_paid',
 *   amountCollected: Number,
 *   transactionId?: String,
 *   note?: String
 * }
 */
exports.riderCompleteDelivery = async (req, res) => {
  try {
    const { paymentMethod, amountCollected, transactionId, note } = req.body;

    const order = await Order.findOne({ _id: req.params.id, 'rider.riderId': req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found / not assigned to you' });
    if (order.status !== 'shipped') {
      return res.status(400).json({ message: `Order must be "shipped" before delivery. Current: ${order.status}` });
    }

    const onlinePrePaid = paymentMethod === 'online_already_paid' || order.paymentStatus === 'paid';
    const collectMethod = onlinePrePaid ? null : paymentMethod;

    if (!onlinePrePaid) {
      if (!paymentMethod) return res.status(400).json({ message: 'Payment method required' });
      const validMethods = ['cod', 'bkash', 'nagad', 'rocket', 'card', 'bank', 'other'];
      if (!validMethods.includes(paymentMethod)) {
        return res.status(400).json({ message: `Invalid payment method: ${paymentMethod}` });
      }
      const amt = Number(amountCollected);
      if (!amt || amt < order.total) {
        return res.status(400).json({ message: `Amount collected (${amt}) must be ≥ order total (${order.total})` });
      }
      if (['bkash', 'nagad', 'rocket', 'card', 'bank'].includes(paymentMethod) && !transactionId) {
        return res.status(400).json({ message: 'Transaction ID required for digital payments' });
      }
    }

    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.rider.deliveredAt = new Date();
    order.paymentStatus = 'paid';
    order.paymentCollection = {
      method:        collectMethod,
      amount:        onlinePrePaid ? order.total : Number(amountCollected),
      transactionId: transactionId || null,
      note:          note || null,
      collectedAt:   new Date(),
      collectedBy:   req.user._id,
    };
    order.statusHistory.push({
      status: 'delivered',
      note:   onlinePrePaid
        ? 'Delivered. Payment was already received online.'
        : `Delivered. Collected ${amountCollected} via ${paymentMethod}${transactionId ? ` (txn: ${transactionId})` : ''}`,
      changedBy: req.user._id,
    });
    await order.save();

    // Update rider stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'riderProfile.activeOrders': -1, 'riderProfile.completedOrders': 1 },
    });

    emitOrderEvent('order_updated', order);

    return res.json({ message: 'Delivery completed', data: order });
  } catch (err) {
    console.error('[riderCompleteDelivery]', err);
    return res.status(500).json({ message: 'Could not complete delivery' });
  }
};
