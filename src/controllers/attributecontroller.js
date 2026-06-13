'use strict';
// 📁 PATH: src/controllers/attributecontroller.js
// FIXED VERSION
//
// মূল bug fixes:
//   1) adminAddValue / adminUpdateValue — frontend `{ label, value }` পাঠায়,
//      backend আগে শুধু `valueData` পড়ত। এখন `value` ও `valueData` দুটোই accept করে।
//   2) Subdocument response এ .toObject() — JSON.stringify-এর সময়
//      "Unexpected token '\"', \"<id>\"... is not valid JSON" ধরনের
//      malformed response এড়াতে। সবসময় plain object return করি।
//   3) adminGetStats — undefined `Attribute` ব্যবহার করা হচ্ছিল,
//      `AttributeModel` করা হলো (নাহলে call করলেই 500 ResponseError)।
//   4) defensive: attr.values না থাকলে [] ধরে নেওয়া।

const mongoose = require('mongoose');
const slugify  = require('slugify');

const { ApiError, ApiResponse } = require('../utils/apiHelpers');
const AttributeModel = require('../models/AttributeModel');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// helper — যেকোনো Mongoose doc/subdoc থেকে safe plain object
const toPlain = (d) => {
  if (!d) return d;
  if (typeof d.toObject === 'function') return d.toObject({ depopulate: true, virtuals: false });
  return d;
};

/* ══════════════════════════════════════════════════════════════════════════════
   ADMIN CONTROLLERS
══════════════════════════════════════════════════════════════════════════════ */

// ── GET /api/admin/attributes ─────────────────────────────────────────────────
exports.adminGetAll = async (req, res, next) => {
  try {
    const { search, type, status } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }
    if (type)   filter.type     = type;
    if (status) filter.isActive = status === 'active';

    const attributes = await AttributeModel
      .find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    const allAttrs = await AttributeModel.find({}).lean();
    const stats = {
      total:       allAttrs.length,
      active:      allAttrs.filter(a => a.isActive).length,
      inactive:    allAttrs.filter(a => !a.isActive).length,
      filterable:  allAttrs.filter(a => a.isFilterable).length,
      variant:     allAttrs.filter(a => a.isVariant).length,
      totalValues: allAttrs.reduce((s, a) => s + (a.values?.length || 0), 0),
    };

    return ApiResponse.success(res, { attributes, stats });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/attributes/stats ──────────────────────────────────────────
exports.adminGetStats = async (req, res, next) => {
  try {
    // FIX: ছিল `Attribute` (undefined) → `AttributeModel`
    const all = await AttributeModel.find({}).lean();
    const stats = {
      total:       all.length,
      active:      all.filter(a => a.isActive).length,
      inactive:    all.filter(a => !a.isActive).length,
      filterable:  all.filter(a => a.isFilterable).length,
      variant:     all.filter(a => a.isVariant).length,
      totalValues: all.reduce((s, a) => s + (a.values?.length || 0), 0),
    };
    return ApiResponse.success(res, stats);
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/attributes/:id ─────────────────────────────────────────────
exports.adminGetById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return next(new ApiError(400, 'Invalid attribute ID'));

    const attr = await AttributeModel.findById(id).lean();
    if (!attr) return next(new ApiError(404, 'Attribute not found'));

    return ApiResponse.success(res, attr);
  } catch (err) {
    next(err);
  }
};

// ── POST /api/admin/attributes ────────────────────────────────────────────────
exports.adminCreate = async (req, res, next) => {
  try {
    const { name, slug, type, isFilterable, isVariant, isActive, sortOrder } = req.body;

    if (!name) return next(new ApiError(400, 'Attribute name is required'));

    const finalSlug = slug || slugify(name, { lower: true, strict: true });
    const exists = await AttributeModel.findOne({ slug: finalSlug });
    if (exists) return next(new ApiError(409, `Slug "${finalSlug}" already exists`));

    const attr = await AttributeModel.create({
      name,
      slug:         finalSlug,
      type:         type         ?? 'select',
      isFilterable: isFilterable ?? false,
      isVariant:    isVariant    ?? true,
      isActive:     isActive     ?? true,
      sortOrder:    sortOrder    ?? 0,
    });

    return ApiResponse.created(res, toPlain(attr), 'Attribute created');
  } catch (err) {
    if (err.code === 11000) return next(new ApiError(409, 'Slug already exists'));
    next(err);
  }
};

// ── PUT /api/admin/attributes/:id ─────────────────────────────────────────────
exports.adminUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return next(new ApiError(400, 'Invalid attribute ID'));

    const allowed = ['name', 'slug', 'type', 'isFilterable', 'isVariant', 'isActive', 'sortOrder'];
    const update  = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const attr = await AttributeModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!attr) return next(new ApiError(404, 'Attribute not found'));

    return ApiResponse.success(res, attr, 'Attribute updated');
  } catch (err) {
    if (err.code === 11000) return next(new ApiError(409, 'Slug already exists'));
    next(err);
  }
};

// ── DELETE /api/admin/attributes/:id ──────────────────────────────────────────
exports.adminDelete = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return next(new ApiError(400, 'Invalid attribute ID'));

    const attr = await AttributeModel.findByIdAndDelete(id);
    if (!attr) return next(new ApiError(404, 'Attribute not found'));

    return ApiResponse.success(res, null, 'Attribute deleted');
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/attributes/:id/toggle ────────────────────────────────────
exports.adminToggle = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return next(new ApiError(400, 'Invalid attribute ID'));

    const attr = await AttributeModel.findById(id);
    if (!attr) return next(new ApiError(404, 'Attribute not found'));

    attr.isActive = !attr.isActive;
    await attr.save();

    return ApiResponse.success(
      res,
      toPlain(attr),
      `Attribute ${attr.isActive ? 'activated' : 'deactivated'}`,
    );
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/attributes/reorder ───────────────────────────────────────
exports.adminReorder = async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return next(new ApiError(400, 'items array required'));
    }

    const ops = items.map(({ id, sortOrder }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder } },
      },
    }));
    await AttributeModel.bulkWrite(ops);

    return ApiResponse.success(res, null, 'Reordered');
  } catch (err) {
    next(err);
  }
};

/* ══════════════════════════════════════════════════════════════════════════════
   VALUE-LEVEL CONTROLLERS
══════════════════════════════════════════════════════════════════════════════ */

// ── POST /api/admin/attributes/:attrId/values ─────────────────────────────────
exports.adminAddValue = async (req, res, next) => {
  try {
    const { attrId } = req.params;
    if (!isValidId(attrId)) return next(new ApiError(400, 'Invalid attribute ID'));

    // FIX: frontend `value` পাঠায় (color hex / slug). আগের কোডে শুধু
    // `valueData` পড়া হচ্ছিল, তাই value কখনও save হতো না।
    const { label, value, valueData, slug, sortOrder, isActive } = req.body;
    if (!label || !String(label).trim()) {
      return next(new ApiError(400, 'Value label is required'));
    }

    const attr = await AttributeModel.findById(attrId);
    if (!attr) return next(new ApiError(404, 'Attribute not found'));

    const cleanLabel = String(label).trim();
    const finalSlug  = (slug && String(slug).trim())
      || slugify(cleanLabel, { lower: true, strict: true });

    // color attribute হলে value = hex, নাহলে value = custom slug (optional)
    const finalValueData = (valueData ?? value ?? '').toString();

    const newValue = {
      label:     cleanLabel,
      slug:      finalSlug,
      valueData: finalValueData,
      sortOrder: sortOrder ?? (attr.values?.length ?? 0),
      isActive:  isActive  ?? true,
    };

    attr.values.push(newValue);
    await attr.save();

    // FIX: subdocument সরাসরি না পাঠিয়ে plain object — JSON serialization safe
    const addedDoc = attr.values[attr.values.length - 1];
    const added = toPlain(addedDoc);

    return ApiResponse.created(res, added, 'Value added');
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/attributes/:attrId/values/:valId ───────────────────────────
exports.adminUpdateValue = async (req, res, next) => {
  try {
    const { attrId, valId } = req.params;
    if (!isValidId(attrId)) return next(new ApiError(400, 'Invalid attribute ID'));

    const attr = await AttributeModel.findById(attrId);
    if (!attr) return next(new ApiError(404, 'Attribute not found'));

    const val = attr.values.id(valId);
    if (!val) return next(new ApiError(404, 'Value not found'));

    // FIX: frontend `value` field-ও accept করি (valueData-তে map)
    if (req.body.value !== undefined && req.body.valueData === undefined) {
      val.valueData = String(req.body.value);
    }

    const allowed = ['label', 'slug', 'valueData', 'sortOrder', 'isActive'];
    allowed.forEach(k => { if (req.body[k] !== undefined) val[k] = req.body[k]; });

    // label বদলালে slug রিজেনারেট (যদি slug explicitly না দেওয়া থাকে)
    if (req.body.label && !req.body.slug) {
      val.slug = slugify(String(req.body.label), { lower: true, strict: true });
    }

    await attr.save();
    return ApiResponse.success(res, toPlain(val), 'Value updated');
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/admin/attributes/:attrId/values/:valId ────────────────────────
exports.adminDeleteValue = async (req, res, next) => {
  try {
    const { attrId, valId } = req.params;
    if (!isValidId(attrId)) return next(new ApiError(400, 'Invalid attribute ID'));

    const attr = await AttributeModel.findById(attrId);
    if (!attr) return next(new ApiError(404, 'Attribute not found'));

    const val = attr.values.id(valId);
    if (!val) return next(new ApiError(404, 'Value not found'));

    val.deleteOne();
    await attr.save();

    return ApiResponse.success(res, null, 'Value deleted');
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/attributes/:attrId/values/reorder ────────────────────────
exports.adminReorderValues = async (req, res, next) => {
  try {
    const { attrId } = req.params;
    if (!isValidId(attrId)) return next(new ApiError(400, 'Invalid attribute ID'));

    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return next(new ApiError(400, 'items array required'));
    }

    const attr = await AttributeModel.findById(attrId);
    if (!attr) return next(new ApiError(404, 'Attribute not found'));

    items.forEach(({ id, sortOrder }) => {
      const val = attr.values.id(id);
      if (val) val.sortOrder = sortOrder;
    });

    attr.values.sort((a, b) => a.sortOrder - b.sortOrder);
    await attr.save();

    return ApiResponse.success(res, attr.values.map(toPlain), 'Values reordered');
  } catch (err) {
    next(err);
  }
};

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC CONTROLLERS
══════════════════════════════════════════════════════════════════════════════ */

exports.publicGetAll = async (req, res, next) => {
  try {
    const attributes = await AttributeModel
      .find({ isActive: true })
      .select('name slug type isFilterable isVariant values')
      .sort({ sortOrder: 1 })
      .lean();

    const filtered = attributes.map(a => ({
      ...a,
      values: (a.values || [])
        .filter(v => v.isActive)
        .sort((x, y) => x.sortOrder - y.sortOrder),
    }));

    return ApiResponse.success(res, filtered);
  } catch (err) {
    next(err);
  }
};

exports.publicGetByCategory = async (req, res, next) => {
  try {
    const attributes = await AttributeModel
      .find({ isActive: true, isFilterable: true })
      .select('name slug type values')
      .sort({ sortOrder: 1 })
      .lean();

    const filtered = attributes.map(a => ({
      ...a,
      values: (a.values || []).filter(v => v.isActive),
    }));

    return ApiResponse.success(res, filtered);
  } catch (err) {
    next(err);
  }
};
