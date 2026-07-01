// 📁 PATH: src/controllers/analyticsController.js
'use strict';

const Order    = require('../models/OrderModel');
const User     = require('../models/User');
const Product  = require('../models/ProductModel');
const Cart     = require('../models/Cart.model');
const Coupon   = require('../models/CouponModel');

// ─────────────────────────────────────────────────────────────────────────────
// Date-range helpers
// ─────────────────────────────────────────────────────────────────────────────

// range query param → { start, end, prevStart, prevEnd, days }
function getRangeDates(range = '30d') {
  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1y' ? 365 : 30;

  const end = new Date(); // now
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const prevEnd = new Date(start);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days);

  return { start, end, prevStart, prevEnd, days };
}

// % change helper — handles divide-by-zero gracefully
function pctChange(curr, prev) {
  if (!prev) return curr > 0 ? 100 : 0;
  return Number((((curr - prev) / prev) * 100).toFixed(1));
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Builds the array of time buckets (day/week/month) to plot on charts —
// shape matches what the frontend chart components expect ({label, key, start, end})
function buildPeriods(range) {
  const now = new Date();
  const points = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 12 : 12;
  const isWeekly = range === '90d';
  const isMonthly = range === '1y';

  const periods = [];
  for (let i = 0; i < points; i++) {
    const d = new Date(now);
    let start, end, key, label;

    if (isMonthly) {
      d.setMonth(now.getMonth() - (points - 1 - i));
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      end   = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = d.toLocaleDateString('en', { month: 'short' });
    } else if (isWeekly) {
      d.setDate(now.getDate() - (points - 1 - i) * 7);
      end = new Date(d); end.setHours(23, 59, 59, 999);
      start = new Date(d); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
      key   = start.toISOString().slice(0, 10);
      label = `W${Math.ceil(d.getDate() / 7)}`;
    } else {
      d.setDate(now.getDate() - (points - 1 - i));
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      end   = new Date(start); end.setDate(end.getDate() + 1);
      key   = start.toISOString().slice(0, 10);
      label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    }

    periods.push({ key, label, start, end });
  }
  return periods;
}

const ORDER_STATUS_META = {
  pending:   { label: 'Pending',   color: '#94a3b8' },
  confirmed: { label: 'Confirmed', color: '#f59e0b' },
  shipped:   { label: 'Shipped',   color: '#3b82f6' },
  delivered: { label: 'Delivered', color: '#22c55e' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
  refunded:  { label: 'Refunded',  color: '#f97316' },
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/analytics/overview
// ─────────────────────────────────────────────────────────────────────────────
exports.getOverview = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end, prevStart, prevEnd } = getRangeDates(range);

    const notCancelled = (s, e) => ({ createdAt: { $gte: s, $lt: e }, status: { $ne: 'cancelled' } });

    const [
      currRevenueAgg, prevRevenueAgg,
      currOrders, prevOrders,
      cancelledCurr, refundedCurr,
      cartsCurr, cartsPrev,
      totalBuyers, newBuyersCurr, newBuyersPrev,
      activeProducts, lowStockCount,
    ] = await Promise.all([
      Order.aggregate([{ $match: notCancelled(start, end) }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.aggregate([{ $match: notCancelled(prevStart, prevEnd) }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      Order.countDocuments({ createdAt: { $gte: prevStart, $lt: prevEnd } }),
      Order.countDocuments({ createdAt: { $gte: start, $lt: end }, status: 'cancelled' }),
      Order.countDocuments({ createdAt: { $gte: start, $lt: end }, status: 'refunded' }),
      Cart.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      Cart.countDocuments({ createdAt: { $gte: prevStart, $lt: prevEnd } }),
      User.countDocuments({ role: 'buyer' }),
      User.countDocuments({ role: 'buyer', createdAt: { $gte: start, $lt: end } }),
      User.countDocuments({ role: 'buyer', createdAt: { $gte: prevStart, $lt: prevEnd } }),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ trackInventory: true, stock: { $lte: 5 } }),
    ]);

    const totalRevenue = currRevenueAgg[0]?.total || 0;
    const prevRevenue  = prevRevenueAgg[0]?.total || 0;

    const totalOrders = currOrders;
    const avgOrderValue     = totalOrders ? totalRevenue / totalOrders : 0;
    const prevAvgOrderValue = prevOrders ? prevRevenue / prevOrders : 0;

    const conversionRate     = cartsCurr ? (totalOrders / cartsCurr) * 100 : 0;
    const prevConversionRate = cartsPrev ? (prevOrders / cartsPrev) * 100 : 0;

    const returnRate     = totalOrders ? (cancelledCurr / totalOrders) * 100 : 0;
    const refundRate     = totalOrders ? (refundedCurr / totalOrders) * 100 : 0;

    return res.json({
      data: {
        totalRevenue:    round2(totalRevenue),
        revenueChange:   pctChange(totalRevenue, prevRevenue),
        totalOrders,
        ordersChange:    pctChange(totalOrders, prevOrders),
        totalCustomers:  totalBuyers,
        customersChange: pctChange(newBuyersCurr, newBuyersPrev),
        conversionRate:  round2(conversionRate),
        conversionChange: pctChange(conversionRate, prevConversionRate),
        avgOrderValue:   round2(avgOrderValue),
        aovChange:       pctChange(avgOrderValue, prevAvgOrderValue),
        activeProducts,
        lowStockCount,
        returnRate:      round2(returnRate),
        returnChange:    0, // needs historical cancellation snapshot — not tracked yet
        refundRate:      round2(refundRate),
        refundChange:    0, // needs historical refund snapshot — not tracked yet
      },
    });
  } catch (err) {
    console.error('getOverview error:', err);
    return res.status(500).json({ message: 'Failed to load analytics overview' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/analytics/revenue
// ─────────────────────────────────────────────────────────────────────────────
exports.getRevenue = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const periods = buildPeriods(range);
    const overallStart = periods[0].start;
    const overallEnd   = periods[periods.length - 1].end;

    const [orders, carts] = await Promise.all([
      Order.find({ createdAt: { $gte: overallStart, $lt: overallEnd }, status: { $ne: 'cancelled' } })
        .select('total createdAt')
        .lean(),
      Cart.find({ createdAt: { $gte: overallStart, $lt: overallEnd } }).select('createdAt').lean(),
    ]);

    const series = periods.map((p) => {
      const periodOrders = orders.filter((o) => o.createdAt >= p.start && o.createdAt < p.end);
      const periodCarts  = carts.filter((c) => c.createdAt >= p.start && c.createdAt < p.end);
      return {
        label:    p.label,
        revenue:  round2(periodOrders.reduce((s, o) => s + (o.total || 0), 0)),
        orders:   periodOrders.length,
        visitors: periodCarts.length, // best-effort activity proxy — no dedicated visitor tracking yet
      };
    });

    return res.json({ data: series });
  } catch (err) {
    console.error('getRevenue error:', err);
    return res.status(500).json({ message: 'Failed to load revenue series' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/analytics/customers/growth
// ─────────────────────────────────────────────────────────────────────────────
exports.getCustomerGrowth = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const periods = buildPeriods(range);
    const overallStart = periods[0].start;
    const overallEnd   = periods[periods.length - 1].end;

    const [buyers, totalBefore] = await Promise.all([
      User.find({ role: 'buyer', createdAt: { $gte: overallStart, $lt: overallEnd } })
        .select('createdAt').lean(),
      User.countDocuments({ role: 'buyer', createdAt: { $lt: overallStart } }),
    ]);

    let cumulative = totalBefore;
    const series = periods.map((p) => {
      const newCount = buyers.filter((b) => b.createdAt >= p.start && b.createdAt < p.end).length;
      cumulative += newCount;
      return { label: p.label, new: newCount, total: cumulative };
    });

    return res.json({ data: series });
  } catch (err) {
    console.error('getCustomerGrowth error:', err);
    return res.status(500).json({ message: 'Failed to load customer growth' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/analytics/funnel
// Built from real cart → order pipeline (no separate visitor/pageview tracking
// exists in the system yet, so the funnel starts from "Carts Created").
// ─────────────────────────────────────────────────────────────────────────────
exports.getFunnel = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getRangeDates(range);
    const dateMatch = { createdAt: { $gte: start, $lt: end } };

    const [cartsCreated, ordersPlaced, ordersConfirmed, ordersShipped, ordersDelivered] = await Promise.all([
      Cart.countDocuments(dateMatch),
      Order.countDocuments(dateMatch),
      Order.countDocuments({ ...dateMatch, status: { $in: ['confirmed', 'shipped', 'delivered'] } }),
      Order.countDocuments({ ...dateMatch, status: { $in: ['shipped', 'delivered'] } }),
      Order.countDocuments({ ...dateMatch, status: 'delivered' }),
    ]);

    const stages = [
      { stage: 'Carts Created',    count: cartsCreated,    color: '#6c63ff' },
      { stage: 'Checkout Started', count: ordersPlaced,    color: '#8b83ff' },
      { stage: 'Order Confirmed',  count: ordersConfirmed, color: '#a78bfa' },
      { stage: 'Order Shipped',    count: ordersShipped,   color: '#c4b5fd' },
      { stage: 'Order Delivered',  count: ordersDelivered, color: '#ddd6fe' },
    ];

    const base = stages[0].count || 1;
    const data = stages.map((s) => ({ ...s, pct: round2((s.count / base) * 100) }));

    return res.json({ data });
  } catch (err) {
    console.error('getFunnel error:', err);
    return res.status(500).json({ message: 'Failed to load conversion funnel' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/analytics/orders/status
// ─────────────────────────────────────────────────────────────────────────────
exports.getOrdersByStatus = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getRangeDates(range);

    const rows = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const countMap = new Map(rows.map((r) => [r._id, r.count]));
    const data = Object.entries(ORDER_STATUS_META)
      .map(([status, meta]) => ({ status: meta.label, count: countMap.get(status) || 0, color: meta.color }))
      .filter((d) => d.count > 0);

    return res.json({ data });
  } catch (err) {
    console.error('getOrdersByStatus error:', err);
    return res.status(500).json({ message: 'Failed to load orders by status' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/analytics/products/top
// ─────────────────────────────────────────────────────────────────────────────
exports.getTopProducts = async (req, res) => {
  try {
    const { range = '30d', limit = 7 } = req.query;
    const { start, end, prevStart, prevEnd } = getRangeDates(range);
    const baseMatch = { status: { $ne: 'cancelled' } };

    const aggForRange = (s, e) => Order.aggregate([
      { $match: { ...baseMatch, createdAt: { $gte: s, $lt: e } } },
      { $unwind: '$items' },
      {
        $group: {
          _id:      '$items.productId',
          name:     { $first: '$items.productName' },
          sku:      { $first: '$items.variantSku' },
          revenue:  { $sum: '$items.lineTotal' },
          orderIds: { $addToSet: '$_id' },
        },
      },
      { $project: { name: 1, sku: 1, revenue: 1, orders: { $size: '$orderIds' } } },
      { $sort: { revenue: -1 } },
      { $limit: Number(limit) },
    ]);

    const [curr, prevRows] = await Promise.all([
      aggForRange(start, end),
      aggForRange(prevStart, prevEnd),
    ]);

    const prevMap = new Map(prevRows.map((r) => [String(r._id), r.revenue]));

    const data = curr.map((p) => {
      const prevRevenue = prevMap.get(String(p._id)) || 0;
      return {
        name:    p.name || 'Unknown product',
        sku:     p.sku || '—',
        revenue: round2(p.revenue),
        orders:  p.orders,
        trend:   pctChange(p.revenue, prevRevenue),
      };
    });

    return res.json({ data });
  } catch (err) {
    console.error('getTopProducts error:', err);
    return res.status(500).json({ message: 'Failed to load top products' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/analytics/products/categories
// ─────────────────────────────────────────────────────────────────────────────
exports.getTopCategories = async (req, res) => {
  try {
    const { range = '30d', limit = 5 } = req.query;
    const { start, end } = getRangeDates(range);

    const rows = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end }, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from:         'products',
          localField:   'items.productId',
          foreignField: '_id',
          as:           'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from:         'categories',
          localField:   'product.category',
          foreignField: '_id',
          as:           'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id:      { $ifNull: ['$category.name', 'Uncategorized'] },
          revenue:  { $sum: '$items.lineTotal' },
          orderIds: { $addToSet: '$_id' },
        },
      },
      { $project: { name: '$_id', revenue: 1, orders: { $size: '$orderIds' } } },
      { $sort: { revenue: -1 } },
      { $limit: Number(limit) },
    ]);

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0) || 1;
    const data = rows.map((r) => ({
      name:    r.name,
      revenue: round2(r.revenue),
      orders:  r.orders,
      share:   round2((r.revenue / totalRevenue) * 100),
    }));

    return res.json({ data });
  } catch (err) {
    console.error('getTopCategories error:', err);
    return res.status(500).json({ message: 'Failed to load revenue by category' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/analytics/coupons
// ─────────────────────────────────────────────────────────────────────────────
exports.getCouponStats = async (req, res) => {
  try {
    const { range = '30d', limit = 5 } = req.query;
    const { start, end } = getRangeDates(range);

    const [rows, totalOrders] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lt: end },
            status: { $ne: 'cancelled' },
            couponCode: { $ne: null },
          },
        },
        {
          $group: {
            _id:      '$couponCode',
            uses:     { $sum: 1 },
            discount: { $sum: '$couponDiscount' },
            revenue:  { $sum: '$total' },
          },
        },
        { $sort: { uses: -1 } },
        { $limit: Number(limit) },
      ]),
      Order.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    ]);

    const data = rows.map((r) => ({
      code:     r._id,
      uses:     r.uses,
      discount: round2(r.discount),
      revenue:  round2(r.revenue),
      conv:     totalOrders ? round2((r.uses / totalOrders) * 100) : 0,
    }));

    return res.json({ data });
  } catch (err) {
    console.error('getCouponStats error:', err);
    return res.status(500).json({ message: 'Failed to load coupon performance' });
  }
};