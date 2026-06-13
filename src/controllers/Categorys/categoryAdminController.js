// 📁 PATH: controllers/category.controller.admin.js
'use strict';

const mongoose = require('mongoose');
const slugify = require('slugify');
const Category = require('../../models/CategoryModel');

const buildTree = require('../../utils/buildTree');
const { broadcast } = require('../../utils/sseManager');
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// const buildTree = (list, parentId = null) =>
//   list
//     .filter(c => String(c.parentId ?? null) === String(parentId))
//     .sort((a, b) => a.sortOrder - b.sortOrder)
//     .map(c => ({ ...c, children: buildTree(list, c._id) }));

/* ══════════════════════════════════════════════════════════
   GET /api/admin/categories
   Admin — সব categories (active + inactive), pagination
   Query: ?page=1&limit=50&parentId=xxx&isActive=true
══════════════════════════════════════════════════════════ */
exports.getAllCategories = async (req, res) => {
  try {
    const { page = 1, limit = 50, parentId, isActive } = req.query;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (parentId) filter.parentId = parentId === 'null' ? null : parentId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Category.countDocuments(filter);

    const categories = await Category
      .find(filter)
      .populate('parentId', 'name slug')
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      data: categories,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[admin.getAll]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ══════════════════════════════════════════════════════════
   GET /api/admin/categories/tree
   Admin — সব categories nested tree (active + inactive)
══════════════════════════════════════════════════════════ */




exports.getTreeCategories = async (req, res) => {
  try {
    const all = await Category
      .find()
      .sort({ sortOrder: 1 })
      .lean();

    const tree = buildTree(all);

    return res.status(200).json({ success: true, data: tree });
  } catch (err) {
    console.error('[admin.getTree]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
/* ══════════════════════════════════════════════════════════
   POST /api/admin/categories
   Admin — নতুন category create
══════════════════════════════════════════════════════════ */
exports.createCategory = async (req, res) => {

  try {
    broadcast("categories", "category_updated")
    const { name, slug, parentId, sortOrder, isActive, image } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    // Parent check
    if (parentId) {
      if (!isValidId(parentId)) {
        return res.status(400).json({ success: false, message: 'Invalid parentId' });
      }
      const parent = await Category.findById(parentId).lean();
      if (!parent) {
        return res.status(404).json({ success: false, message: 'Parent category not found' });
      }
    }

    // Slug — frontend পাঠালে সেটা, না হলে name থেকে generate
    const resolvedSlug = slug?.trim()
      ? slug.trim().toLowerCase()
      : slugify(name.trim(), { lower: true, strict: true });

    const slugExists = await Category.findOne({ slug: resolvedSlug }).lean();
    if (slugExists) {
      return res.status(409).json({ success: false, message: `Slug "${resolvedSlug}" already exists` });
    }

    const category = await Category.create({
      name: name.trim(),
      slug: resolvedSlug,
      parentId: parentId || null,
      sortOrder: sortOrder ?? 0,
      isActive: isActive !== undefined ? isActive : true,
      image: {
        url: image?.url || '',
        publicId: image?.publicId || '',
      },
    });

    broadcast("categories", "category_updated")

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Slug already exists' });
    }
    console.error('[admin.create]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ══════════════════════════════════════════════════════════
   PUT /api/admin/categories/:id
   Admin — full update (frontend PUT পাঠাচ্ছে)
══════════════════════════════════════════════════════════ */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const { name, slug, parentId, sortOrder, isActive, image } = req.body;

    // Parent validation
    if (parentId !== undefined) {
      if (parentId && !isValidId(parentId)) {
        return res.status(400).json({ success: false, message: 'Invalid parentId' });
      }
      if (parentId === id) {
        return res.status(400).json({ success: false, message: 'Category cannot be its own parent' });
      }
      if (parentId) {
        const parent = await Category.findById(parentId).lean();
        if (!parent) {
          return res.status(404).json({ success: false, message: 'Parent category not found' });
        }
      }
      category.parentId = parentId || null;
    }

    // Slug conflict check
    if (slug !== undefined) {
      const newSlug = slug.trim().toLowerCase();
      const conflict = await Category.findOne({ slug: newSlug, _id: { $ne: id } }).lean();
      if (conflict) {
        return res.status(409).json({ success: false, message: `Slug "${newSlug}" already in use` });
      }
      category.slug = newSlug;
    }

    if (name !== undefined) category.name = name.trim();
    if (sortOrder !== undefined) category.sortOrder = sortOrder;
    if (isActive !== undefined) category.isActive = isActive;
    if (image !== undefined) category.image = { url: image?.url || '', publicId: image?.publicId || '' };

    await category.save();

    return res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Slug already exists' });
    }
    console.error('[admin.update]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ══════════════════════════════════════════════════════════
   DELETE /api/admin/categories/:id
   Admin — soft delete (isActive: false)
          ?hard=true হলে permanent delete
══════════════════════════════════════════════════════════ */
exports.deactivateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const hardDelete = req.query.hard === 'true';

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Children থাকলে delete করতে দেবো না
    const childCount = await Category.countDocuments({ parentId: id });
    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — ${childCount} subcategorie(s) exist. Delete or reassign them first.`,
      });
    }

    if (hardDelete) {
      await Category.findByIdAndDelete(id);
      return res.status(200).json({ success: true, message: 'Category permanently deleted' });
    }

    // Soft delete
    category.isActive = false;
    await category.save();

    return res.status(200).json({
      success: true,
      message: 'Category deactivated',
      data: category,
    });
  } catch (err) {
    console.error('[admin.remove]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};



exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;


    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }


    await Category.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: 'Category permanently deleted' });

  } catch (err) {
    console.error('[admin.remove]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};




/* ══════════════════════════════════════════════════════════
   PATCH /api/admin/categories/reorder
   Admin — drag & drop sort order update
   Body: { items: [{ id, sortOrder }, ...] }
══════════════════════════════════════════════════════════ */


exports.reorder = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required' });
    }

    // Bulk write — একটা query তে সব update
    const bulkOps = items.map(({ id, sortOrder }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder } },
      },
    }));

    await Category.bulkWrite(bulkOps);

    return res.status(200).json({ success: true, message: 'Categories reordered successfully' });
  } catch (err) {
    console.error('[admin.reorder]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ══════════════════════════════════════════════════════════
   PATCH /api/admin/categories/:id/toggle
   Admin — isActive toggle (active ↔ inactive)
══════════════════════════════════════════════════════════ */
exports.toggle = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    category.isActive = !category.isActive;
    await category.save();

    return res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'}`,
      data: { _id: category._id, isActive: category.isActive },
    });
  } catch (err) {
    console.error('[admin.toggle]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};