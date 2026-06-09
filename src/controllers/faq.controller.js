'use strict';
const Faq = require('../models/Faq.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Faq, {
  searchFields: ["question","answer","category"],
  filterFields: ["category","isActive"],
  resourceName: 'Faq',
});
