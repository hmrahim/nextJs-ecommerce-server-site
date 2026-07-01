// 📁 PATH: src/controllers/customerController.js
'use strict';

const User = require('../models/User');
const Order = require('../models/OrderModel');
const Wishlist = require('../models/WishlistModel');
const Review = require('../models/ReviewModel');
const Visitor = require('../models/Visitor.model');
const { emitChange } = require('../utils/socket');
const { sendBrevoEmail } = require('../services/emailService');

// Helper to compute stats for a single customer
async function getCustomerStats(userId) {
  const stats = await Order.aggregate([
    { $match: { userId: userId } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$total' },
        lastOrderAt: { $max: '$createdAt' }
      }
    }
  ]);
  return stats[0] || { totalOrders: 0, totalSpent: 0, lastOrderAt: null };
}

// GET /admin/customers - All customers (role=buyer)
exports.adminGetAll = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 15, 1);
    const skip = (page - 1) * limit;

    const { search, status, tag, dateFrom, dateTo, sortField, sortDir, segment } = req.query;

    const match = { role: 'buyer' };

    if (search) {
      match.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      if (status === 'active') {
        match.isActive = true;
        match.isBanned = false;
        match.emailVerified = true;
      } else if (status === 'inactive') {
        match.isActive = false;
        match.isBanned = false;
      } else if (status === 'banned') {
        match.isBanned = true;
      } else if (status === 'unverified') {
        match.emailVerified = false;
      }
    }

    if (tag) {
      match.tags = tag;
    }

    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) match.createdAt.$lte = new Date(dateTo);
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'userId',
          as: 'orders'
        }
      },
      {
        $addFields: {
          totalOrders: { $size: '$orders' },
          totalSpent: { $sum: '$orders.total' },
          ltv: { $sum: '$orders.total' },
          lastOrderAt: { $max: '$orders.createdAt' }
        }
      },
      { $project: { orders: 0, passwordHash: 0 } }
    ];

    if (segment) {
      const segmentMatch = {};
      if (segment === 'active') {
        segmentMatch.isActive = true;
        segmentMatch.isBanned = false;
        segmentMatch.emailVerified = true;
      } else if (segment === 'vip') {
        segmentMatch.tags = 'VIP';
      } else if (segment === 'new') {
        segmentMatch.createdAt = { $gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
      } else if (segment === 'at_risk') {
        segmentMatch.$or = [
          { tags: 'At Risk' },
          {
            $and: [
              { lastOrderAt: { $lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } },
              { lastOrderAt: { $ne: null } },
              { isActive: true }
            ]
          }
        ];
      } else if (segment === 'inactive') {
        segmentMatch.isActive = false;
        segmentMatch.isBanned = false;
      } else if (segment === 'unverified') {
        segmentMatch.emailVerified = false;
        segmentMatch.isBanned = false;
      } else if (segment === 'banned') {
        segmentMatch.isBanned = true;
      }
      pipeline.push({ $match: segmentMatch });
    }

    const sort = {};
    if (sortField) {
      sort[sortField] = sortDir === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }
    pipeline.push({ $sort: sort });

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: skip }, { $limit: limit }]
      }
    });

    const results = await User.aggregate(pipeline);
    const customers = results[0]?.data || [];
    const total = results[0]?.metadata[0]?.total || 0;
    const pages = Math.ceil(total / limit);

    // Fetch counts for segments
    const allBuyers = await User.aggregate([
      { $match: { role: 'buyer' } },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'userId',
          as: 'orders'
        }
      },
      {
        $addFields: {
          lastOrderAt: { $max: '$orders.createdAt' }
        }
      },
      { $project: { orders: 0 } }
    ]);

    const counts = {
      all: allBuyers.length,
      active: allBuyers.filter(c => c.isActive && !c.isBanned && c.emailVerified).length,
      vip: allBuyers.filter(c => c.tags?.includes('VIP')).length,
      new: allBuyers.filter(c => new Date(c.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length,
      at_risk: allBuyers.filter(c => c.tags?.includes('At Risk') || (c.lastOrderAt && new Date(c.lastOrderAt) < new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) && c.isActive)).length,
      inactive: allBuyers.filter(c => !c.isActive && !c.isBanned).length,
      unverified: allBuyers.filter(c => !c.emailVerified && !c.isBanned).length,
      banned: allBuyers.filter(c => c.isBanned).length
    };

    // Calculate stats
    const totalRevenueResult = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const revenue = totalRevenueResult[0]?.total || 0;

    const stats = {
      total: counts.all,
      active: counts.active,
      new: counts.new,
      vip: counts.vip,
      banned: counts.banned,
      revenue
    };

    return res.status(200).json({
      success: true,
      customers,
      counts,
      stats,
      pagination: {
        page,
        total,
        pages,
        limit
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/customers/stats - Customer stats overview
exports.adminGetStats = async (req, res, next) => {
  try {
    const total = await User.countDocuments({ role: 'buyer' });
    const active = await User.countDocuments({ role: 'buyer', isActive: true, isBanned: false, emailVerified: true });
    const newCustomers = await User.countDocuments({ role: 'buyer', createdAt: { $gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });
    const vip = await User.countDocuments({ role: 'buyer', tags: 'VIP' });
    const banned = await User.countDocuments({ role: 'buyer', isBanned: true });

    const totalRevenueResult = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const revenue = totalRevenueResult[0]?.total || 0;

    return res.status(200).json({
      success: true,
      stats: {
        total,
        active,
        new: newCustomers,
        vip,
        banned,
        revenue
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/customers/:id - Single customer detail
exports.adminGetById = async (req, res, next) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'buyer' }).select('-passwordHash');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const stats = await getCustomerStats(customer._id);
    const obj = customer.toObject();
    obj.totalOrders = stats.totalOrders;
    obj.totalSpent = stats.totalSpent;
    obj.ltv = stats.totalSpent;
    obj.lastOrderAt = stats.lastOrderAt;

    return res.status(200).json({
      success: true,
      customer: obj
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/customers - Create customer
exports.adminCreate = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password || 'Moom24Customer123!', 10);

    const customer = await User.create({
      firstName,
      lastName,
      email,
      phone,
      passwordHash,
      role: 'buyer',
      emailVerified: true
    });

    const doc = customer.toPublicJSON();
    emitChange('User', 'create', { id: doc._id, doc });

    return res.status(201).json({
      success: true,
      customer: doc
    });
  } catch (err) {
    next(err);
  }
};

// PUT /admin/customers/:id - Update customer
exports.adminUpdate = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, isActive } = req.body;

    const customer = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'buyer' },
      { $set: { firstName, lastName, email, phone, isActive } },
      { new: true }
    ).select('-passwordHash');

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    emitChange('User', 'update', { id: customer._id, doc: customer });

    return res.status(200).json({
      success: true,
      customer
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /admin/customers/:id - Delete customer
exports.adminDelete = async (req, res, next) => {
  try {
    const customer = await User.findOneAndDelete({ _id: req.params.id, role: 'buyer' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    emitChange('User', 'delete', { id: req.params.id });

    return res.status(200).json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/customers/bulk-delete - Bulk delete
exports.adminBulkDelete = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) {
      return res.status(400).json({ success: false, message: 'No IDs provided' });
    }

    await User.deleteMany({ _id: { $in: ids }, role: 'buyer' });

    ids.forEach(id => emitChange('User', 'delete', { id }));

    return res.status(200).json({
      success: true,
      message: `${ids.length} customers deleted successfully`
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /admin/customers/:id/toggle-ban - Toggle ban status
exports.adminToggleBan = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const customer = await User.findOne({ _id: req.params.id, role: 'buyer' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.isBanned = !customer.isBanned;
    customer.banReason = customer.isBanned ? reason || 'Banned by Administrator' : '';
    await customer.save();

    emitChange('User', 'update', { id: customer._id, doc: customer });

    return res.status(200).json({
      success: true,
      customer
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /admin/customers/:id/toggle-verify - Toggle email verification
exports.adminToggleVerify = async (req, res, next) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'buyer' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.emailVerified = !customer.emailVerified;
    await customer.save();

    emitChange('User', 'update', { id: customer._id, doc: customer });

    return res.status(200).json({
      success: true,
      customer
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /admin/customers/:id/toggle-active - Toggle active status
exports.adminToggleActive = async (req, res, next) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'buyer' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.isActive = !customer.isActive;
    await customer.save();

    emitChange('User', 'update', { id: customer._id, doc: customer });

    return res.status(200).json({
      success: true,
      customer
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /admin/customers/:id/role - Change role
exports.adminChangeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const customer = await User.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    customer.role = role;
    await customer.save();

    emitChange('User', 'update', { id: customer._id, doc: customer });

    return res.status(200).json({
      success: true,
      customer
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/customers/:id/orders - Customer orders list
exports.adminGetOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.params.id }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      orders
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/customers/:id/wishlist - Customer wishlist
exports.adminGetWishlist = async (req, res, next) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.params.id }).populate('items.product');
    return res.status(200).json({
      success: true,
      wishlist: wishlist?.items || []
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/customers/:id/reviews - Customer reviews
exports.adminGetReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ userId: req.params.id }).populate('productId');
    return res.status(200).json({
      success: true,
      reviews
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/customers/:id/activity - Customer activity
exports.adminGetActivity = async (req, res, next) => {
  try {
    const visitors = await Visitor.find({ userId: req.params.id }).sort({ lastActiveAt: -1 }).limit(20);
    return res.status(200).json({
      success: true,
      activity: visitors
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/customers/:id/addresses - Customer addresses
exports.adminGetAddresses = async (req, res, next) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'buyer' }).select('addresses');
    return res.status(200).json({
      success: true,
      addresses: customer?.addresses || []
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/customers/:id/notes - Add note
exports.adminAddNote = async (req, res, next) => {
  try {
    const { text } = req.body;
    const customer = await User.findOne({ _id: req.params.id, role: 'buyer' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.notes.push({ text, author: 'Admin', createdAt: new Date() });
    await customer.save();

    emitChange('User', 'update', { id: customer._id, doc: customer });

    return res.status(200).json({
      success: true,
      notes: customer.notes
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /admin/customers/:id/notes/:noteId - Delete note
exports.adminDeleteNote = async (req, res, next) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'buyer' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.notes = customer.notes.filter(n => String(n._id) !== req.params.noteId);
    await customer.save();

    emitChange('User', 'update', { id: customer._id, doc: customer });

    return res.status(200).json({
      success: true,
      notes: customer.notes
    });
  } catch (err) {
    next(err);
  }
};

// PUT /admin/customers/:id/notes/:noteId - Edit note
exports.adminEditNote = async (req, res, next) => {
  try {
    const { text } = req.body;
    const customer = await User.findOne({ _id: req.params.id, role: 'buyer' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const note = customer.notes.id(req.params.noteId);
    if (note) {
      note.text = text;
      await customer.save();
    }

    emitChange('User', 'update', { id: customer._id, doc: customer });

    return res.status(200).json({
      success: true,
      notes: customer.notes
    });
  } catch (err) {
    next(err);
  }
};

const buildCustomerEmailTemplate = (toName, subject, body) => {
  const bodyHtml = body.replace(/\n/g, '<br/>');
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\${subject}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      body, table, td, a { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#07070a;color:#cbd5e1;-webkit-font-smoothing:antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#07070a;padding:50px 16px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#121221 0%,#09090f 100%);border-radius:32px;border:1px solid rgba(16,185,129,0.3);overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,0.8);">
            <!-- Top Decorative Glowing Line -->
            <tr>
              <td height="5" style="background:linear-gradient(90deg,#059669 0%,#10b981 50%,#34d399 100%);"></td>
            </tr>
            
            <!-- Header (Brand & Logo) -->
            <tr>
              <td style="padding:45px 40px 35px;text-align:center;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <span style="font-size:36px;font-weight:900;color:#ffffff;letter-spacing:-1px;text-shadow:0 0 20px rgba(16,185,129,0.3);font-family:'Plus Jakarta Sans', Arial, sans-serif;">Moom<span style="color:#10b981;">24</span></span>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top:12px;">
                      <div style="display:inline-block;padding:6px 14px;background-color:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:100px;color:#34d399;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">
                        Secure Notification
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:0 40px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.06);"><tr><td></td></tr></table>
              </td>
            </tr>

            <!-- Message Body -->
            <tr>
              <td style="padding:40px 45px 35px;">
                <h2 style="margin:0 0 16px;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Hello \${toName},</h2>
                <div style="color:#cbd5e1;font-size:15px;line-height:1.8;font-weight:400;margin-bottom:35px;">
                  \${bodyHtml}
                </div>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.06);margin-bottom:35px;"><tr><td></td></tr></table>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:10px 0 25px;">
                      <a href="https://moom24.com" target="_blank" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#059669 0%,#10b981 100%);color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;border-radius:16px;box-shadow:0 12px 24px rgba(16,185,129,0.3);text-transform:uppercase;letter-spacing:1px;">
                        Visit Moom24 Storefront
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer Area -->
            <tr>
              <td style="padding:40px;background-color:#08080d;border-top:1px solid rgba(255,255,255,0.04);text-align:center;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:15px;">
                      <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;max-width:320px;">
                        You received this email because you are a registered customer of Moom24.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <p style="margin:0;color:#334155;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                        © \${new Date().getFullYear()} Moom24 Inc. All Rights Reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
};

// POST /admin/customers/:id/send-email - Send email
exports.adminSendEmail = async (req, res, next) => {
  try {
    const { subject, body } = req.body;
    const customer = await User.findOne({ _id: req.params.id, role: 'buyer' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const toName = `${customer.firstName} ${customer.lastName}`;
    await sendBrevoEmail({
      to: customer.email,
      toName,
      subject,
      htmlContent: buildCustomerEmailTemplate(toName, subject, body)
    });

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully'
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/customers/bulk-email - Bulk email
exports.adminBulkEmail = async (req, res, next) => {
  try {
    const { ids, subject, body } = req.body;
    const customers = await User.find({ _id: { $in: ids }, role: 'buyer' });

    for (const customer of customers) {
      const toName = `${customer.firstName} ${customer.lastName}`;
      await sendBrevoEmail({
        to: customer.email,
        toName,
        subject,
        htmlContent: buildCustomerEmailTemplate(toName, subject, body)
      }).catch(console.error);
    }

    return res.status(200).json({
      success: true,
      message: 'Emails sent successfully'
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/customers/:id/tags - Add tag
exports.adminAddTag = async (req, res, next) => {
  try {
    const { tag } = req.body;
    const customer = await User.findOne({ _id: req.params.id, role: 'buyer' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (!customer.tags.includes(tag)) {
      customer.tags.push(tag);
      await customer.save();
    }

    emitChange('User', 'update', { id: customer._id, doc: customer });

    return res.status(200).json({
      success: true,
      tags: customer.tags
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /admin/customers/:id/tags/:tag - Remove tag
exports.adminRemoveTag = async (req, res, next) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'buyer' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.tags = customer.tags.filter(t => t !== req.params.tag);
    await customer.save();

    emitChange('User', 'update', { id: customer._id, doc: customer });

    return res.status(200).json({
      success: true,
      tags: customer.tags
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/customers/export - Export customers as CSV
exports.adminExport = async (req, res, next) => {
  try {
    const allBuyers = await User.aggregate([
      { $match: { role: 'buyer' } },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'userId',
          as: 'orders'
        }
      },
      {
        $addFields: {
          totalOrders: { $size: '$orders' },
          totalSpent: { $sum: '$orders.total' },
          ltv: { $sum: '$orders.total' },
          lastOrderAt: { $max: '$orders.createdAt' }
        }
      },
      { $project: { orders: 0, passwordHash: 0 } },
      { $sort: { createdAt: -1 } }
    ]);

    const hdr = ['ID','First Name','Last Name','Email','Phone','Orders','Total Spent','LTV','Status','Tags','Joined'];
    const rows = allBuyers.map(c => [
      c._id, c.firstName, c.lastName, c.email, c.phone || '',
      c.totalOrders, c.totalSpent, c.ltv || 0,
      c.isBanned ? 'Banned' : !c.isActive ? 'Inactive' : !c.emailVerified ? 'Unverified' : 'Active',
      (c.tags || []).join(';'),
      new Date(c.createdAt).toLocaleDateString(),
    ]);

    const csv = [hdr, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=customers_${new Date().toISOString().slice(0,10)}.csv`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};
