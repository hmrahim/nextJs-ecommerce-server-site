'use strict';
const Notification = require('../models/Notification.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Notification, {
  searchFields: [],
  filterFields: ["userId","type","isRead"],
  resourceName: 'Notification',
});
