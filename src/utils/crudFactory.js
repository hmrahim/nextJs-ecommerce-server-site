'use strict';
const asyncHandler = require('./asyncHandler');
const { ApiResponse, ApiError } = require('./apiHelpers');
const { parsePagination, buildMeta } = require('./pagination');
const { buildFilter } = require('./buildFilter');

/**
 * Generic, production-grade CRUD controller factory.
 * Every resource gets list (paginated + filter + sort), getOne, create, update, remove.
 * Custom controllers may extend the returned object.
 *
 * @param {import('mongoose').Model} Model
 * @param {Object}  opts
 * @param {String[]} opts.searchFields    - fields used for ?search=
 * @param {String[]} opts.filterFields    - exact-match filter whitelist
 * @param {String[]} opts.populate        - paths to populate
 * @param {Object}   opts.defaultSort     - e.g. { createdAt: -1 }
 * @param {Function} opts.beforeCreate    - async (data, req) => data
 * @param {Function} opts.beforeUpdate    - async (data, req, doc) => data
 * @param {Function} opts.afterCreate     - async (doc, req) => void
 * @param {Function} opts.afterUpdate     - async (doc, req) => void
 * @param {Function} opts.afterRemove     - async (doc, req) => void
 * @param {String}   opts.resourceName    - used in messages
 */
function crudFactory(Model, opts = {}) {
  const {
    searchFields = [],
    filterFields = [],
    populate = [],
    defaultSort = { createdAt: -1 },
    beforeCreate,
    beforeUpdate,
    afterCreate,
    afterUpdate,
    afterRemove,
    resourceName = Model.modelName,
  } = opts;

  const list = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = buildFilter(req.query, { searchFields, filterFields });
    const sort = req.query.sort
      ? { [String(req.query.sort).replace(/^-/, '')]: String(req.query.sort).startsWith('-') ? -1 : 1 }
      : defaultSort;

    let q = Model.find(filter).sort(sort).skip(skip).limit(limit);
    for (const p of populate) q = q.populate(p);

    const [data, total] = await Promise.all([q.lean(), Model.countDocuments(filter)]);
    return ApiResponse.paginated(res, data, buildMeta(total, page, limit));
  });

  const getOne = asyncHandler(async (req, res) => {
    let q = Model.findById(req.params.id);
    for (const p of populate) q = q.populate(p);
    const doc = await q;
    if (!doc) throw new ApiError(404, `${resourceName} not found`);
    return ApiResponse.success(res, doc);
  });

  const create = asyncHandler(async (req, res) => {
    let payload = req.body;
    if (beforeCreate) payload = await beforeCreate(payload, req);
    const doc = await Model.create(payload);
    if (afterCreate) await afterCreate(doc, req);
    return ApiResponse.created(res, doc, `${resourceName} created`);
  });

  const update = asyncHandler(async (req, res) => {
    const existing = await Model.findById(req.params.id);
    if (!existing) throw new ApiError(404, `${resourceName} not found`);
    let payload = req.body;
    if (beforeUpdate) payload = await beforeUpdate(payload, req, existing);
    Object.assign(existing, payload);
    await existing.save();
    if (afterUpdate) await afterUpdate(existing, req);
    return ApiResponse.success(res, existing, `${resourceName} updated`);
  });

  const remove = asyncHandler(async (req, res) => {
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) throw new ApiError(404, `${resourceName} not found`);
    if (afterRemove) await afterRemove(doc, req);
    return ApiResponse.success(res, { id: doc._id }, `${resourceName} deleted`);
  });

  return { list, getOne, create, update, remove };
}

module.exports = crudFactory;
