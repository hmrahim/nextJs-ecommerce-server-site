
const mongoose = require('mongoose');
const slugify  = require('slugify');

const categorySchema = new mongoose.Schema(
  {
    parentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    name:      { type: String, required: true, trim: true, maxlength: 100 },
    slug:      { type: String, unique: true, lowercase: true },
    image: {
      url:      { type: String, trim: true, default: '' },
      publicId: { type: String, trim: true, default: '' },
    },
    sortOrder: { type: Number, default: 0 },
    isActive:  { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
    toJSON: { virtuals: true },
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentId: 1 });
categorySchema.index({ isActive: 1, sortOrder: 1 });

/* ── Pre-save: auto-generate slug ───────────────────────── */
categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

/* ── Virtual: subcategories ──────────────────────────────── */
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentId',
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;