'use strict';
// Lightweight upload routes. Image binary upload is handled on the client (e.g. Cloudinary widget);
// the backend simply stores the resulting URLs against a resource.
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/apiHelpers');
const { protect } = require('../middleware/auth.middleware');

// Generate Cloudinary signature for direct browser upload (optional but recommended).
router.post('/signature', protect, asyncHandler(async (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new ApiError(503, 'Cloudinary is not configured on the server');
  }
  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = req.body.folder || 'moom24';
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');
  return ApiResponse.success(res, { timestamp, folder, signature, apiKey, cloudName });
}));

// Persist already-uploaded URLs against a resource (e.g. product images list).
router.post('/save-url', protect, asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') throw new ApiError(400, 'url is required');
  // Naive URL sanity check.
  if (!/^https?:\/\//.test(url)) throw new ApiError(422, 'url must be http(s)');
  return ApiResponse.success(res, { url }, 'Saved');
}));

module.exports = router;
