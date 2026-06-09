'use strict';
const Category = require('../models/Category.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Category, {
  searchFields: ["name","slug"],
  filterFields: ["parentId","isActive"],
  resourceName: 'Category',
});
