// 📁 PATH: controllers/category.controller.public.js
'use strict';

const mongoose = require('mongoose');
const Category = require('../models/Category');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const buildTree = (list, parentId = null) =>
  list
    .filter(c => String(c.parentId ?? null) === String(parentId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(c => ({ ...c, children: buildTree(list, c._id) }));

/* ══════════════════════════════════════════════════════════
   GET /api/categories
   Public — শুধু active categories, pagination support
   Query: ?page=1&limit=50&parentId=xxx
══════════════════════════════════════════════════════════ */
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, parentId } = req.query;

    const filter = { isActive: true };
    if (parentId) filter.parentId = parentId === 'null' ? null : parentId;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Category.countDocuments(filter);

    const categories = await Category
      .find(filter)
      .select('name slug image parentId sortOrder')
      .sort({ sortOrder: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return res.status(200).json({
      success: true,
      data: categories,
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[public.getAll]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ══════════════════════════════════════════════════════════
   GET /api/categories/tree
   Public — active categories nested tree
══════════════════════════════════════════════════════════ */
exports.getTree = async (req, res) => {
  try {
    const all = await Category
      .find({ isActive: true })
      .select('name slug image parentId sortOrder')
      .sort({ sortOrder: 1 })
      .lean();

    const tree = buildTree(all);

    return res.status(200).json({ success: true, data: tree });
  } catch (err) {
    console.error('[public.getTree]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ══════════════════════════════════════════════════════════
   GET /api/categories/:slug
   Public — slug দিয়ে single active category
══════════════════════════════════════════════════════════ */
exports.getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const category = await Category
      .findOne({ slug, isActive: true })
      .select('name slug image parentId sortOrder')
      .populate('parentId', 'name slug')
      .populate({ path: 'subcategories', match: { isActive: true }, select: 'name slug image sortOrder' })
      .lean({ virtuals: true });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    return res.status(200).json({ success: true, data: category });
  } catch (err) {
    console.error('[public.getBySlug]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};