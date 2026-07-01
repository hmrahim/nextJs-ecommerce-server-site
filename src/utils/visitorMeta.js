// 📁 PATH: src/utils/visitorMeta.js
// Helper functions for the visitor-tracking feature — no browser permission
// prompts anywhere: device/browser comes from the User-Agent header, and
// location comes from a server-side IP lookup (not navigator.geolocation).
'use strict';

const { UAParser } = require('ua-parser-js');
const logger = require('./logger');

/* ─────────────────────────────────────────────────────────────
   IP extraction (works behind Railway's reverse proxy — make sure
   app.set('trust proxy', 1) is enabled in app.js)
───────────────────────────────────────────────────────────── */
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  return (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('::ffff:127.')
  );
}

/* ─────────────────────────────────────────────────────────────
   Device / browser / OS — parsed from User-Agent header only.
───────────────────────────────────────────────────────────── */
function parseUserAgent(uaString = '') {
  const parser = new UAParser(uaString);
  const result = parser.getResult();

  const deviceType = result.device?.type; // 'mobile' | 'tablet' | undefined(=desktop)
  const device = deviceType === 'mobile' ? 'Mobile' : deviceType === 'tablet' ? 'Tablet' : 'Desktop';

  const os = result.os?.name ? `${result.os.name}${result.os.version ? ' ' + result.os.version : ''}` : 'Unknown';
  const browser = result.browser?.name ? `${result.browser.name}${result.browser.version ? ' ' + result.browser.version.split('.')[0] : ''}` : 'Unknown';

  return { device, os, browser };
}

/* ─────────────────────────────────────────────────────────────
   Traffic-source classification from the referrer URL.
───────────────────────────────────────────────────────────── */
const SOCIAL_HOSTS  = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'linkedin.com', 'pinterest.com', 'snapchat.com', 't.co'];
const SEARCH_HOSTS   = ['google.', 'bing.com', 'yahoo.', 'duckduckgo.com', 'baidu.com', 'yandex.'];
const EMAIL_HOSTS    = ['mail.google.com', 'outlook.', 'mail.yahoo.com', 'webmail.'];

function classifySource(referrerUrl, ownHost) {
  if (!referrerUrl) return 'Direct';
  try {
    const host = new URL(referrerUrl).hostname.replace(/^www\./, '');
    if (ownHost && host === ownHost) return 'Direct';
    if (SEARCH_HOSTS.some((h) => host.includes(h))) return 'Organic Search';
    if (SOCIAL_HOSTS.some((h) => host.includes(h))) return 'Social Media';
    if (EMAIL_HOSTS.some((h) => host.includes(h))) return 'Email';
    return 'Referral';
  } catch {
    return 'Direct';
  }
}

/* ─────────────────────────────────────────────────────────────
   Country → currency (best-effort, covers Moom24's target markets
   plus common fallbacks).
───────────────────────────────────────────────────────────── */
const CURRENCY_MAP = {
  SA: 'SAR', AE: 'AED', BD: 'BDT', GB: 'GBP', US: 'USD', IN: 'INR',
  PK: 'PKR', KW: 'KWD', QA: 'QAR', BH: 'BHD', OM: 'OMR', EG: 'EGP',
};
function currencyForCountry(countryCode) {
  return CURRENCY_MAP[countryCode] || 'USD';
}

/* ─────────────────────────────────────────────────────────────
   IP → geo/ISP lookup via ip-api.com (free, no API key, no
   permission prompt — server-to-server call). Cached in-memory
   per IP for 24h to stay well under the free-tier rate limit.
───────────────────────────────────────────────────────────── */
const geoCache = new Map(); // ip -> { data, expiresAt }
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000;

async function lookupGeo(ip) {
  if (isPrivateIp(ip)) {
    return {
      country: 'Unknown', countryCode: null, city: 'Unknown', region: null,
      lat: null, lng: null, timezone: null, isp: 'Local / Development', postalCode: null,
    };
  }

  const cached = geoCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,query`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const json = await res.json();

    if (json.status !== 'success') throw new Error('geo lookup failed');

    const data = {
      country:    json.country || 'Unknown',
      countryCode: json.countryCode || null,
      city:       json.city || 'Unknown',
      region:     json.regionName || null,
      lat:        json.lat ?? null,
      lng:        json.lon ?? null,
      timezone:   json.timezone || null,
      isp:        json.isp || null,
      postalCode: json.zip || null,
    };

    geoCache.set(ip, { data, expiresAt: Date.now() + GEO_CACHE_TTL });
    return data;
  } catch (err) {
    logger.warn(`Visitor geo lookup failed for ${ip}: ${err.message}`);
    return {
      country: 'Unknown', countryCode: null, city: 'Unknown', region: null,
      lat: null, lng: null, timezone: null, isp: null, postalCode: null,
    };
  }
}

module.exports = {
  getClientIp,
  isPrivateIp,
  parseUserAgent,
  classifySource,
  currencyForCountry,
  lookupGeo,
};
