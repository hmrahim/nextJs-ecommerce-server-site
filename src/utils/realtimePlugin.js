// 📁 utils/realtimePlugin.js
// Mongoose plugin — automatically emits realtime socket events whenever
// ANY document on ANY model is created, updated, or deleted.
//
// Registered globally in `config/database.js` BEFORE the models are loaded.
'use strict';

const { emitChange } = require('./socket');

function getResourceName(doc) {
  return doc?.constructor?.modelName || doc?.modelName || 'Unknown';
}

function safePayload(doc) {
  if (!doc) return {};
  const id = doc._id ? String(doc._id) : undefined;
  return { id };
}

module.exports = function realtimePlugin(schema) {
  /* ── document.save() ─────────────────────────────── */
  schema.post('save', function (doc) {
    try {
      const action = this.wasNew ? 'create' : 'update';
      emitChange(getResourceName(doc), action, safePayload(doc));
    } catch (_) {}
  });

  // capture isNew BEFORE save so post('save') knows create vs update
  schema.pre('save', function (next) {
    this.wasNew = this.isNew;
    next();
  });

  /* ── Model.insertMany() ──────────────────────────── */
  schema.post('insertMany', function (docs) {
    try {
      if (!Array.isArray(docs)) return;
      docs.forEach((d) => emitChange(getResourceName(d), 'create', safePayload(d)));
    } catch (_) {}
  });

  /* ── findOneAndUpdate / findByIdAndUpdate / updateOne / updateMany ─ */
  ['findOneAndUpdate', 'updateOne', 'updateMany', 'findByIdAndUpdate'].forEach((hook) => {
    schema.post(hook, function (res) {
      try {
        const modelName = this.model?.modelName || 'Unknown';
        // findOneAndUpdate returns the doc; updateOne/Many returns a result obj
        const id =
          res && res._id
            ? String(res._id)
            : this.getQuery && this.getQuery()?._id
              ? String(this.getQuery()._id)
              : undefined;
        emitChange(modelName, 'update', { id });
      } catch (_) {}
    });
  });

  /* ── findOneAndDelete / deleteOne / deleteMany / findByIdAndDelete ─ */
  ['findOneAndDelete', 'deleteOne', 'deleteMany', 'findByIdAndDelete', 'findOneAndRemove'].forEach((hook) => {
    schema.post(hook, function (res) {
      try {
        const modelName = this.model?.modelName || 'Unknown';
        const id =
          res && res._id
            ? String(res._id)
            : this.getQuery && this.getQuery()?._id
              ? String(this.getQuery()._id)
              : undefined;
        emitChange(modelName, 'delete', { id });
      } catch (_) {}
    });
  });

  /* ── document.remove()  (legacy) ─────────────────── */
  schema.post('remove', function (doc) {
    try {
      emitChange(getResourceName(doc), 'delete', safePayload(doc));
    } catch (_) {}
  });
};
