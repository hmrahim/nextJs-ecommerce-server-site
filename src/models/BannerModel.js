// 📁 PATH: src/models/BannerModel.js
'use strict';

const mongoose = require('mongoose');

// ─── Platform IDs ─────────────────────────────────────────────────────────────
const PLATFORM_IDS = ['web', 'mobile', 'both'];

// ─── Placement IDs — Web (Next.js App) ────────────────────────────────────────
const WEB_PLACEMENT_IDS = [
  'web_home_hero_slider',
  'web_home_side_panel_1',
  'web_home_side_panel_2',
  'web_home_promo_banner_1',
  'web_home_promo_banner_2',
  'web_category_page_top',
  'web_checkout_promo',
  'web_flash_sale_banner',
  'web_shop_page_banner',
  'web_popup',
];

// ─── Placement IDs — Mobile (Expo App) ────────────────────────────────────────
const MOBILE_PLACEMENT_IDS = [
  'mobile_home_hero',
  'mobile_home_carousel',
  'mobile_category_banner',
  'mobile_product_detail_banner',
  'mobile_cart_promo',
  'mobile_splash_promo',
  'mobile_offer_popup',
];

// ─── All placement IDs combined ───────────────────────────────────────────────
const ALL_PLACEMENT_IDS = [...WEB_PLACEMENT_IDS, ...MOBILE_PLACEMENT_IDS];

// ─── Legacy placement IDs (for backward compatibility) ────────────────────────
const LEGACY_PLACEMENT_IDS = [
  'home_hero',
  'home_strip',
  'home_grid_a',
  'home_grid_b',
  'category_top',
  'checkout_promo',
  'app_popup',
];

const PLACEMENT_IDS = [...ALL_PLACEMENT_IDS, ...LEGACY_PLACEMENT_IDS];

const STATUS_IDS = ['live', 'scheduled', 'paused', 'expired', 'draft'];

const LINK_TYPE_IDS = ['url', 'product', 'category', 'brand', 'page', 'none'];

const DEVICE_IDS = ['all', 'mobile', 'desktop'];

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Title is required'],
      trim:      true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },

    subtitle: {
      type:      String,
      trim:      true,
      maxlength: [200, 'Subtitle cannot exceed 200 characters'],
      default:   '',
    },

    buttonText: {
      type:      String,
      trim:      true,
      maxlength: [40, 'Button text cannot exceed 40 characters'],
      default:   'Shop now',
    },

    // NEW: Platform field — which platform this banner targets
    platform: {
      type:    String,
      enum:    { values: PLATFORM_IDS, message: 'Invalid platform: {VALUE}' },
      default: 'both',
    },

    // UPDATED: Now supports multiple placements (array)
    placements: {
      type:    [String],
      validate: {
        validator: function(arr) {
          return arr.every(p => PLACEMENT_IDS.includes(p));
        },
        message: 'One or more placements are invalid',
      },
      default: [],
    },

    // KEPT for backward compatibility — single placement (legacy)
    placement: {
      type:     String,
      enum:     { values: [...PLACEMENT_IDS, ''], message: 'Invalid placement: {VALUE}' },
      default:  '',
    },

    status: {
      type:    String,
      enum:    { values: STATUS_IDS, message: 'Invalid status: {VALUE}' },
      default: 'draft',
    },

    priority: {
      type:    Number,
      default: 5,
      min:     [1, 'Priority must be at least 1'],
    },

    image: {
      type:    String,
      trim:    true,
      default: '',
    },

    linkType: {
      type:    String,
      enum:    { values: LINK_TYPE_IDS, message: 'Invalid link type: {VALUE}' },
      default: 'url',
    },

    linkValue: {
      type:    String,
      trim:    true,
      default: '',
    },

    startsAt: {
      type:    Date,
      default: null,
    },

    endsAt: {
      type:    Date,
      default: null,
    },

    devices: {
      type:    String,
      enum:    { values: DEVICE_IDS, message: 'Invalid devices value: {VALUE}' },
      default: 'all',
    },

    // Analytics — never set directly from admin form
    clicks: {
      type:    Number,
      default: 0,
      min:     0,
    },

    impressions: {
      type:    Number,
      default: 0,
      min:     0,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
bannerSchema.index({ platform: 1, status: 1 });
bannerSchema.index({ placements: 1, status: 1 });
bannerSchema.index({ placement: 1, status: 1 });
bannerSchema.index({ priority:  1 });
bannerSchema.index({ title: 'text' });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
bannerSchema.virtual('ctr').get(function () {
  if (!this.impressions) return 0;
  return Number(((this.clicks / this.impressions) * 100).toFixed(2));
});

// ─── Validation ───────────────────────────────────────────────────────────────
bannerSchema.pre('validate', function (next) {
  if (this.startsAt && this.endsAt && this.endsAt < this.startsAt) {
    this.invalidate('endsAt', 'End date must be on or after start date');
  }
  next();
});

// ─── Enum exports for validators / frontend mapping ─────────────────────────
bannerSchema.statics.PLATFORM_IDS       = PLATFORM_IDS;
bannerSchema.statics.WEB_PLACEMENT_IDS  = WEB_PLACEMENT_IDS;
bannerSchema.statics.MOBILE_PLACEMENT_IDS = MOBILE_PLACEMENT_IDS;
bannerSchema.statics.ALL_PLACEMENT_IDS  = ALL_PLACEMENT_IDS;
bannerSchema.statics.PLACEMENT_IDS      = PLACEMENT_IDS;
bannerSchema.statics.STATUS_IDS         = STATUS_IDS;
bannerSchema.statics.LINK_TYPE_IDS      = LINK_TYPE_IDS;
bannerSchema.statics.DEVICE_IDS         = DEVICE_IDS;

const Banner = mongoose.models.Banner || mongoose.model('Banner', bannerSchema);

module.exports = Banner;