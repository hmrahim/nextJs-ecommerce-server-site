// 📁 PATH: models/Blog.js

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    isApproved: { type: Boolean, default: false },
    likes:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

const blogSchema = new mongoose.Schema(
  {
    // ── Core ───────────────────────────────────────────────────────────────
    title: {
      type:     String,
      required: [true, 'Blog title is required'],
      trim:     true,
      maxlength: [200, 'Title max 200 characters'],
    },
    slug: {
      type:     String,
      required: [true, 'Slug is required'],
      unique:   true,
      trim:     true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and hyphens'],
    },
    excerpt: {
      type:     String,
      trim:     true,
      maxlength: [500, 'Excerpt max 500 characters'],
    },
    content: {
      type: String,
      trim: true,
    },

    // ── Classification ─────────────────────────────────────────────────────
    category: {
      type:    String,
      enum:    ['news', 'tutorial', 'review', 'guide', 'lifestyle', 'seller', 'promo'],
      default: 'news',
    },
    tags: [{ type: String, trim: true, lowercase: true }],

    // ── Media ──────────────────────────────────────────────────────────────
    coverImage: {
      url:      { type: String, default: '' },
      publicId: { type: String, default: '' },
    },

    // ── People ─────────────────────────────────────────────────────────────
    author: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Author is required'],
    },

    // ── Status & Workflow ──────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['draft', 'review', 'scheduled', 'published', 'archived'],
      default: 'draft',
    },
    publishedAt: {
      type: Date,
      default: null,
    },

    // ── Flags ──────────────────────────────────────────────────────────────
    isFeatured: { type: Boolean, default: false },

    // ── Reading ────────────────────────────────────────────────────────────
    readTime: { type: Number, default: 5, min: 1, max: 120 },

    // ── Engagement ─────────────────────────────────────────────────────────
    views:         { type: Number, default: 0, min: 0 },
    likes:         { type: Number, default: 0, min: 0 },
    likedBy:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments:      [commentSchema],
    commentsCount: { type: Number, default: 0 },

    // ── SEO ────────────────────────────────────────────────────────────────
    metaTitle:       { type: String, trim: true, maxlength: 70 },
    metaDescription: { type: String, trim: true, maxlength: 160 },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ isFeatured: 1, status: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ createdAt: -1 });
blogSchema.index(
  { title: 'text', excerpt: 'text', tags: 'text' },
  { weights: { title: 10, tags: 5, excerpt: 3 }, name: 'blog_text_search' }
);

// ─── Pre-save hook: auto-set publishedAt ──────────────────────────────────────
blogSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// ─── Pre-save hook: sync commentsCount ────────────────────────────────────────
blogSchema.pre('save', function (next) {
  this.commentsCount = this.comments.filter((c) => c.isApproved).length;
  next();
});

// ─── Virtual: url ─────────────────────────────────────────────────────────────
blogSchema.virtual('url').get(function () {
  return `/blog/${this.slug}`;
});

module.exports = mongoose.model('Blog', blogSchema);
