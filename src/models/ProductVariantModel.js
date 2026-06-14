// 📁 PATH: backend/models/ProductVariant.js
const mongoose = require('mongoose');


const variantAttributeSchema = new mongoose.Schema({
    attributeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attribute', required: true },
    attributeName: { type: String, required: true },  // snapshot (denormalized)
    attributeSlug: { type: String, required: true },
    valueId: { type: String, required: true },  // attribute value এর _id (string)
    valueLabel: { type: String, required: true },  // display name, e.g. "Red"
    valueData: { type: String },                  // hex for color, actual value for others
}, { _id: false });

const productVariantSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true,
    },

    // ── Combination label (auto-generated) ─────────────────────────────────────
    // e.g. "Red / M"  — human readable
    variantTitle: { type: String, required: true },

    // ── Attributes combination ─────────────────────────────────────────────────
    attributes: {
        type: [variantAttributeSchema],
        validate: {
            validator: (v) => v && v.length > 0,
            message: 'Variant must have at least one attribute.',
        },
    },

    // ── Pricing ────────────────────────────────────────────────────────────────
    price: { type: Number, required: true, min: 0 },
    comparePrice: { type: Number, default: 0, min: 0 },
    cost: { type: Number, default: 0, min: 0 },

    // ── Inventory ──────────────────────────────────────────────────────────────
    sku: { type: String, trim: true, sparse: true },
    stock: { type: Number, default: 0, min: 0 },

    // ── Media ──────────────────────────────────────────────────────────────────
    image: { type: String, default: '' },

    // ── Status ─────────────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },

    // ── Sort order ─────────────────────────────────────────────────────────────
    sortOrder: { type: Number, default: 0 },

}, { timestamps: true });

// Compound index: same combination can't appear twice for a product
productVariantSchema.index({ product: 1, variantTitle: 1 }, { unique: true });
productVariantSchema.index({ product: 1, isActive: 1 });

module.exports = mongoose.models.ProductVariant || mongoose.model('ProductVariant', productVariantSchema);
