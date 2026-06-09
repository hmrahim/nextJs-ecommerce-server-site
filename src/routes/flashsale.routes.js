'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/flashsale.controller');
const v      = require('../validators/flashsale.validator');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth.middleware');

router.get('/',     optionalAuth, ctrl.list);
router.get('/:id',  v.idParam, optionalAuth, ctrl.getOne);
router.post('/',    protect, restrictTo('admin'), v.create, ctrl.create);
router.put('/:id',  protect, restrictTo('admin'), v.update, ctrl.update);
router.patch('/:id',protect, restrictTo('admin'), v.update, ctrl.update);
router.delete('/:id', protect, restrictTo('admin'), v.idParam, ctrl.remove);

module.exports = router;
