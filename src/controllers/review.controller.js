'use strict';
const Review = require('../models/Review.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Review, {
  searchFields: [],
  filterFields: ["productId","userId","status"],
  resourceName: 'Review',
});
