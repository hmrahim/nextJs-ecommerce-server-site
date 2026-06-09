'use strict';
const Ticket = require('../models/Ticket.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Ticket, {
  searchFields: ["ticketNumber","subject"],
  filterFields: ["status","priority","userId","assignedTo"],
  resourceName: 'Ticket',
});
