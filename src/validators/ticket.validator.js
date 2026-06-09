'use strict';
const { body, param } = require('express-validator');
const { handleValidation } = require('./validate');

exports.idParam = [param('id').isMongoId().withMessage('Invalid id'), handleValidation];
exports.create  = [handleValidation]; // model-level validation is the source of truth
exports.update  = [param('id').isMongoId().withMessage('Invalid id'), handleValidation];
