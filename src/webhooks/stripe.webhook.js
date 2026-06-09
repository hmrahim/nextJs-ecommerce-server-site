'use strict';
const express = require('express');
const router  = express.Router();
const logger  = require('../utils/logger');
const Order   = require('../models/Order.model');
const Payment = require('../models/Payment.model');
const Transaction = require('../models/Transaction.model');
const { emit } = require('../sockets');

// IMPORTANT: this route uses raw body — mounted BEFORE express.json() in app.js
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig    = req.headers['stripe-signature'];
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return res.status(503).send('Stripe not configured');
  }
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    logger.warn(`Stripe webhook signature error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          const order = await Order.findById(orderId);
          if (order) {
            order.paymentStatus = 'paid';
            order.status = order.status === 'pending' ? 'confirmed' : order.status;
            await order.save();
            await Payment.create({ orderId: order._id, provider: 'stripe', status: 'success', amount: pi.amount / 100, transactionId: pi.id });
            await Transaction.create({ type: 'payment', orderId: order._id, userId: order.userId, amount: pi.amount / 100, currency: pi.currency.toUpperCase(), gateway: 'stripe', reference: pi.id, status: 'success' });
            emit.toUser(order.userId, 'order:paid', { orderId: order._id });
            emit.toAdmins('order:paid', { orderId: order._id });
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          await Order.findByIdAndUpdate(orderId, { paymentStatus: 'failed' });
          await Transaction.create({ type: 'payment', orderId, amount: pi.amount / 100, currency: pi.currency.toUpperCase(), gateway: 'stripe', reference: pi.id, status: 'failed', metadata: { error: pi.last_payment_error?.message } });
        }
        break;
      }
      case 'charge.refunded': {
        const ch = event.data.object;
        await Transaction.create({ type: 'refund', amount: ch.amount_refunded / 100, currency: ch.currency.toUpperCase(), gateway: 'stripe', reference: ch.id, status: 'success' });
        break;
      }
      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }
    res.json({ received: true });
  } catch (err) {
    logger.error(`Stripe webhook handler error: ${err.message}`);
    res.status(500).send('handler error');
  }
});

module.exports = router;
