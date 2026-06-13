// 📁 PATH: backend/controllers/productVariantController.js


const ProductVariantModel = require('../../models/ProductVariantModel');
const Product = require('../../models/ProductModel');

// ── Helper: generate variantTitle from attributes array ────────────────────────
// e.g. [{valueLabel:'Red'},{valueLabel:'M'}] → "Red / M"

function buildVariantTitle(attributes = []) {
  return attributes.map(a => a.valueLabel).join(' / ');
}

// ══════════════════════════════════════════════════════════════════════════════
// @route  GET /api/admin/products/:productId/variants
// @desc   Product এর সব variants দেখাও
// @access Admin
// ══════════════════════════════════════════════════════════════════════════════
exports.getVariants = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const variants = await ProductVariantModel
      .find({ product: productId })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    res.json({ success: true, data: variants });
  } catch (err) {
    console.error('getVariants error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// @route  POST /api/admin/products/:productId/variants
// @desc   একটা নতুন variant তৈরি করো (single)
// @access Admin
//
// Body:
// {
//   attributes: [
//     { attributeId, attributeName, attributeSlug, valueId, valueLabel, valueData }
//   ],
//   price, comparePrice, cost, sku, stock, image, isActive, sortOrder
// }
// ══════════════════════════════════════════════════════════════════════════════
exports.createVariant = async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      attributes, price, comparePrice = 0, cost = 0,
      sku, stock = 0, image = '', isActive = true, sortOrder = 0,
    } = req.body;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (!attributes || attributes.length === 0) {
      return res.status(400).json({ success: false, message: 'Attributes required for variant' });
    }

    const variantTitle = buildVariantTitle(attributes);

    // duplicate check
    const exists = await ProductVariantModel.findOne({ product: productId, variantTitle });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: `Variant "${variantTitle}" already exists for this product`,
      });
    }

    const variant = await ProductVariantModel.create({
      product: productId,
      variantTitle,
      attributes,
      price,
      comparePrice,
      cost,
      sku,
      stock,
      image,
      isActive,
      sortOrder,
    });

    res.status(201).json({ success: true, data: variant });
  } catch (err) {
    console.error('createVariant error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'This variant combination already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// @route  POST /api/admin/products/:productId/variants/bulk
// @desc   Attribute page থেকে bulk generate করো
//         Cartesian product of selected attribute values
//
// Body:
// {
//   attributeSets: [
//     { attributeId, attributeName, attributeSlug, values: [{ valueId, valueLabel, valueData }] },
//     { attributeId, attributeName, attributeSlug, values: [...] },
//   ],
//   defaultPrice: 500,
//   defaultStock: 10,
// }
// ══════════════════════════════════════════════════════════════════════════════
exports.bulkGenerateVariants = async (req, res) => {
  try {
    const { productId } = req.params;
    // variantPrices: { [variantTitle]: price }  — optional, per-variant pricing
    const { attributeSets = [], defaultPrice = 0, defaultStock = 0, variantPrices = {} } = req.body;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (!attributeSets.length) {
      return res.status(400).json({ success: false, message: 'attributeSets required' });
    }

    // ── Cartesian product ──────────────────────────────────────────────────
    // Input:  [[a1,a2], [b1,b2]] → [[a1,b1],[a1,b2],[a2,b1],[a2,b2]]
    const cartesian = (sets) =>
      sets.reduce((acc, set) =>
        acc.flatMap(combo =>
          set.values.map(val => [
            ...combo,
            {
              attributeId:   set.attributeId,
              attributeName: set.attributeName,
              attributeSlug: set.attributeSlug,
              valueId:       val.valueId,
              valueLabel:    val.valueLabel,
              valueData:     val.valueData || '',
            },
          ])
        ), [[]]);

    const combinations = cartesian(attributeSets);

    // ── Insert non-duplicate variants ──────────────────────────────────────
    let created = 0;
    let skipped = 0;

    const existingTitles = new Set(
      (await ProductVariantModel.find({ product: productId }, 'variantTitle').lean())
        .map(v => v.variantTitle)
    );

    const toInsert = [];
    for (const combo of combinations) {
      const variantTitle = buildVariantTitle(combo);
      if (existingTitles.has(variantTitle)) { skipped++; continue; }

      // per-variant price থাকলে সেটা নাও, না থাকলে defaultPrice
      const variantPrice = (variantPrices[variantTitle] !== undefined && variantPrices[variantTitle] !== '')
        ? parseFloat(variantPrices[variantTitle])
        : defaultPrice;

      toInsert.push({
        product:      productId,
        variantTitle,
        attributes:   combo,
        price:        variantPrice,
        comparePrice: 0,
        cost:         0,
        stock:        defaultStock,
        isActive:     true,
        sortOrder:    0,
      });
      existingTitles.add(variantTitle); // prevent duplicates within this batch
    }

    if (toInsert.length) {
      await ProductVariantModel.insertMany(toInsert, { ordered: false });
      created = toInsert.length;
    }

    res.status(201).json({
      success: true,
      message: `${created} variant(s) created, ${skipped} skipped (already exist)`,
      data: { created, skipped, total: combinations.length },
    });
  } catch (err) {
    console.error('bulkGenerateVariants error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// @route  PUT /api/admin/products/:productId/variants/:variantId
// @desc   Variant update (price, stock, sku, image, isActive)
// @access Admin
// ══════════════════════════════════════════════════════════════════════════════
exports.updateVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const allowed = ['price','comparePrice','cost','sku','stock','image','isActive','sortOrder'];
    const update  = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const variant = await ProductVariantModel.findOneAndUpdate(
      { _id: variantId, product: productId },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });

    res.json({ success: true, data: variant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// @route  DELETE /api/admin/products/:productId/variants/:variantId
// @desc   Single variant delete
// @access Admin
// ══════════════════════════════════════════════════════════════════════════════
exports.deleteVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const variant = await ProductVariantModel.findOneAndDelete({ _id: variantId, product: productId });
    if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });
    res.json({ success: true, message: 'Variant deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// @route  DELETE /api/admin/products/:productId/variants
// @desc   Product এর সব variants delete
// @access Admin
// ══════════════════════════════════════════════════════════════════════════════
exports.deleteAllVariants = async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await ProductVariantModel.deleteMany({ product: productId });
    res.json({ success: true, message: `${result.deletedCount} variant(s) deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// @route  PATCH /api/admin/products/:productId/variants/:variantId/toggle
// @desc   isActive toggle
// @access Admin
// ══════════════════════════════════════════════════════════════════════════════
exports.toggleVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const variant = await ProductVariantModel.findOne({ _id: variantId, product: productId });
    if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });

    variant.isActive = !variant.isActive;
    await variant.save();

    res.json({ success: true, data: variant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// @route  GET /api/products/:productId/variants   (public)
// @desc   Client side এ product এর active variants দেখাও
// @access Public
// ══════════════════════════════════════════════════════════════════════════════
exports.getPublicVariants = async (req, res) => {
  try {
    const { productId } = req.params;
    const variants = await ProductVariantModel
      .find({ product: productId, isActive: true })
      .select('-cost -createdAt -updatedAt -__v')
      .sort({ sortOrder: 1 })
      .lean();

    res.json({ success: true, data: variants });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};