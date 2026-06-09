'use strict';
const GiftCard = require('../models/GiftCard.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(GiftCard, {
  searchFields: ["code"],
  filterFields: ["isActive"],
  resourceName: 'GiftCard',
});
