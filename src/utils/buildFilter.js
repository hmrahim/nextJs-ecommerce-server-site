'use strict';
/**
 * Build a MongoDB filter from query string. Supports:
 *   search=foo   → text-ish OR match on `searchFields`
 *   status=x     → exact match
 *   from / to    → createdAt range
 *   <field>=val  → exact match (whitelisted)
 */
function buildFilter(query = {}, { searchFields = [], filterFields = [] } = {}) {
  const filter = {};
  if (query.search && searchFields.length) {
    const rx = new RegExp(String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = searchFields.map((f) => ({ [f]: rx }));
  }
  for (const f of filterFields) {
    if (query[f] !== undefined && query[f] !== '') filter[f] = query[f];
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to)   filter.createdAt.$lte = new Date(query.to);
  }
  return filter;
}
module.exports = { buildFilter };
