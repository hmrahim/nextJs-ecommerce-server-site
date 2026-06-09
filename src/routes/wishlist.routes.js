'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/wishlist.controller');
const v      = require('../validators/wishlist.validator');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth.middleware');

router.get('/',     protect, restrictTo('admin'), ctrl.list);
router.get('/:id',  v.idParam, protect, ctrl.getOne);
router.post('/',    protect, restrictTo('admin'), v.create, ctrl.create);
router.put('/:id',  protect, restrictTo('admin'), v.update, ctrl.update);
router.patch('/:id',protect, restrictTo('admin'), v.update, ctrl.update);
router.delete('/:id', protect, restrictTo('admin'), v.idParam, ctrl.remove);

module.exports = router;
