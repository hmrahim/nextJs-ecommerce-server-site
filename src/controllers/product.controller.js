'use strict';
const Product = require('../models/Product.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Product, {
  searchFields: ["name","sku","description","tags"],
  filterFields: ["categoryId","brandId","isActive","isFeatured"],
  resourceName: 'Product', populate: ["categoryId","brandId"],
});
