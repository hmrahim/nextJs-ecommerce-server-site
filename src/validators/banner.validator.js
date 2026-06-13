'use strict';

const { body } = require('express-validator');
const { handleValidation } = require('./validate');
const Banner = require('../models/BannerModel');

// ─── Shared rules ─────────────────────────────────────────────────────────────
const baseRules = (isUpdate = false) => {
  const optionalIfUpdate = (chain) =>
    isUpdate ? chain.optional({ values: 'falsy' }) : chain;

  return [
    optionalIfUpdate(body('title').exists().withMessage('Title is required'))
      .bail()
      .isString()
      .trim()
      .isLength({ min: 1, max: 150 })
      .withMessage('Title must be between 1 and 150 characters'),

    body('subtitle')
      .optional({ values: 'null' })
      .isString()
      .isLength({ max: 200 })
      .withMessage('Subtitle cannot exceed 200 characters'),

    body('buttonText')
      .optional({ values: 'null' })
      .isString()
      .isLength({ max: 40 })
      .withMessage('Button text cannot exceed 40 characters'),

    optionalIfUpdate(body('placement').exists().withMessage('Placement is required'))
      .bail()
      .isIn(Banner.PLACEMENT_IDS)
      .withMessage(`Placement must be one of: ${Banner.PLACEMENT_IDS.join(', ')}`),

    body('status')
      .optional({ values: 'null' })
      .isIn(Banner.STATUS_IDS)
      .withMessage(`Status must be one of: ${Banner.STATUS_IDS.join(', ')}`),

    body('priority')
      .optional({ values: 'null' })
      .isInt({ min: 1 })
      .withMessage('Priority must be an integer >= 1')
      .toInt(),

    body('image')
      .optional({ values: 'null' })
      .isString()
      .withMessage('Image must be a string (URL or data URI)'),

    body('linkType')
      .optional({ values: 'null' })
      .isIn(Banner.LINK_TYPE_IDS)
      .withMessage(`Link type must be one of: ${Banner.LINK_TYPE_IDS.join(', ')}`),

    body('linkValue')
      .optional({ values: 'null' })
      .isString(),

    body('startsAt')
      .optional({ values: 'null' })
      .isISO8601()
      .withMessage('startsAt must be a valid date (YYYY-MM-DD)'),

    body('endsAt')
      .optional({ values: 'null' })
      .isISO8601()
      .withMessage('endsAt must be a valid date (YYYY-MM-DD)')
      .custom((value, { req }) => {
        const { startsAt } = req.body;
        if (startsAt && value && new Date(value) < new Date(startsAt)) {
          throw new Error('endsAt must be on or after startsAt');
        }
        return true;
      }),

    body('devices')
      .optional({ values: 'null' })
      .isIn(Banner.DEVICE_IDS)
      .withMessage(`Devices must be one of: ${Banner.DEVICE_IDS.join(', ')}`),
  ];
};

const validateCreateBanner = [...baseRules(false), handleValidation];
const validateUpdateBanner = [...baseRules(true),  handleValidation];

module.exports = {
  validateCreateBanner,
  validateUpdateBanner,
};
