// 📁 PATH: backend/src/controllers/variantController/productVariantController.js
'use strict';

const ProductVariantModel = require('../../models/ProductVariantModel');
const Product = require('../../models/ProductModel');

/* ── Helpers ──────────────────────────────────────────────────────────────── */

// Build "Red / M" from attributes array
function buildVariantTitle(attributes = []) {
  return attributes.map(a => a.valueLabel).join(' / ');
}

// Map a ProductVariantModel doc → Product.variants embedded subdoc
function toEmbeddedVariant(v) {
  const attrs = {};
  (v.attributes || []).forEach(a => {
    if (a.attributeName) attrs[a.attributeName] = a.valueLabel;
  });
  return {
    sku:   v.sku || `${v.product}-${v.variantTitle}`.replace(/\s+/g, '-').toUpperCase(),
    attrs,
    price: Number(v.price) || 0,
    stock: Number(v.stock) || 0,
  };
}

// Re-build Product.variants & variantAttributes & aggregated stock
async function syncProductVariants(productId) {
  if (!productId) return;
  const variants = await ProductVariantModel
    .find({ product: productId })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const embedded = variants.map(toEmbeddedVariant);
  const totalStock = variants
    .filter(v => v.isActive !== false)
    .reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  // variantAttributes rebuild — প্রতিটা attribute এর unique values collect করো
  const attrMap = {};
  variants.forEach(v => {
    (v.attributes || []).forEach(a => {
      if (!attrMap[a.attributeSlug]) {
        attrMap[a.attributeSlug] = {
          name: a.attributeName,
          slug: a.attributeSlug,
          values: new Map(),
        };
      }
      if (!attrMap[a.attributeSlug].values.has(a.valueId)) {
        attrMap[a.attributeSlug].values.set(a.valueId, {
          valueId:    a.valueId,
          valueLabel: a.valueLabel,
          valueData:  a.valueData || '',
        });
      }
    });
  });

  const variantAttributes = Object.values(attrMap).map(attr => ({
    name:   attr.name,
    slug:   attr.slug,
    values: [...attr.values.values()],
  }));

  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        variants: embedded,
        variantAttributes,
        ...(variants.length ? { stock: totalStock } : {}),
      },
    },
    { strict: false }
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/admin/products/:productId/variants
═══════════════════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/admin/products/:productId/variants
═══════════════════════════════════════════════════════════════════════════ */
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

    await syncProductVariants(productId);

    res.status(201).json({ success: true, data: variant });
  } catch (err) {
    console.error('createVariant error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'This variant combination already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/admin/products/:productId/variants/bulk
   
   Payload:
   {
     attributeSets: [
       { attributeId, attributeName, attributeSlug, values: [{ valueId, valueLabel, valueData }] },
       { attributeId, attributeName, attributeSlug, values: [...] },
     ],
     defaultPrice: 500,
     defaultStock: 10,
     variantPrices: { "Red / S": 490, "Blue / M": 510 }  // optional, individual mode
   }
   
   Result: Red/S, Red/M, Red/L, Green/S, Green/M, Green/L ... (cartesian)
═══════════════════════════════════════════════════════════════════════════ */
exports.bulkGenerateVariants = async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      attributeSets = [],
      defaultPrice  = 0,
      defaultStock  = 0,
      variantPrices = {},
    } = req.body;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (!attributeSets.length) {
      return res.status(400).json({ success: false, message: 'attributeSets required' });
    }

    // ── Validate: প্রতিটা attributeSet এ কমপক্ষে ১টা value থাকতে হবে ──
    const invalidSet = attributeSets.find(s => !s.values || s.values.length === 0);
    if (invalidSet) {
      return res.status(400).json({
        success: false,
        message: `Attribute "${invalidSet.attributeName}" এ কোনো value select করা হয়নি`,
      });
    }

    // ── Cartesian product ──────────────────────────────────────────────────────
    // attributeSets: [{ values: [{valueId, valueLabel, valueData}] }, ...]
    // Result: সব combinations — [[attr1val1, attr2val1], [attr1val1, attr2val2], ...]
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

    // Existing titles এনে duplicate এড়াও
    const existingTitles = new Set(
      (await ProductVariantModel.find({ product: productId }, 'variantTitle').lean())
        .map(v => v.variantTitle)
    );

    const toInsert = [];
    let skipped    = 0;

    for (const combo of combinations) {
      const variantTitle = buildVariantTitle(combo);

      if (existingTitles.has(variantTitle)) {
        skipped++;
        continue;
      }

      // Price: individual mode এ variantPrices lookup, fallback to defaultPrice
      const variantPrice =
        variantPrices[variantTitle] !== undefined && variantPrices[variantTitle] !== ''
          ? parseFloat(variantPrices[variantTitle])
          : Number(defaultPrice) || 0;

      toInsert.push({
        product:      productId,
        variantTitle,
        attributes:   combo,
        price:        variantPrice,
        comparePrice: 0,
        cost:         0,
        stock:        Number(defaultStock) || 0,
        isActive:     true,
        sortOrder:    0,
      });

      existingTitles.add(variantTitle); // prevent in-batch duplicates
    }

    let created = 0;
    if (toInsert.length) {
      const inserted = await ProductVariantModel.insertMany(toInsert, { ordered: false });
      created = inserted.length;
    }

    // Product এর variantAttributes ও stock sync করো
    await syncProductVariants(productId);

    res.status(201).json({
      success: true,
      message: `${created} variant(s) created, ${skipped} skipped (already exist)`,
      data: { created, skipped, total: combinations.length },
    });
  } catch (err) {
    console.error('bulkGenerateVariants error:', err);
    try { await syncProductVariants(req.params.productId); } catch (_) {}
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   PUT /api/admin/products/:productId/variants/:variantId
═══════════════════════════════════════════════════════════════════════════ */
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

    await syncProductVariants(productId);

    res.json({ success: true, data: variant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   DELETE /api/admin/products/:productId/variants/:variantId
═══════════════════════════════════════════════════════════════════════════ */
exports.deleteVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const variant = await ProductVariantModel.findOneAndDelete({ _id: variantId, product: productId });
    if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });

    await syncProductVariants(productId);

    res.json({ success: true, message: 'Variant deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   DELETE /api/admin/products/:productId/variants
═══════════════════════════════════════════════════════════════════════════ */
exports.deleteAllVariants = async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await ProductVariantModel.deleteMany({ product: productId });

    // variantAttributes ও clear করো product থেকে
    await Product.updateOne(
      { _id: productId },
      { $set: { variants: [], variantAttributes: [], stock: 0 } },
      { strict: false }
    );

    res.json({ success: true, message: `${result.deletedCount} variant(s) deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   PATCH /api/admin/products/:productId/variants/:variantId/toggle
═══════════════════════════════════════════════════════════════════════════ */
exports.toggleVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const variant = await ProductVariantModel.findOne({ _id: variantId, product: productId });
    if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });

    variant.isActive = !variant.isActive;
    await variant.save();

    await syncProductVariants(productId);

    res.json({ success: true, data: variant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/products/:productId/variants   (public)
═══════════════════════════════════════════════════════════════════════════ */
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

// Exposed for one-off re-sync scripts if needed
exports._syncProductVariants = syncProductVariants;
