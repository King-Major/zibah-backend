const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const { serializeOrder } = require('../utils/serializers');
const { cleanString } = require('../utils/helpers');

// @route   GET /api/orders/me
router.get('/me', verifyToken, async (req, res) => {
  const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json(orders.map(serializeOrder));
});

// @route   GET /api/orders/all  (ADMIN)
router.get('/all', verifyToken, verifyAdmin, async (req, res) => {
  const orders = await Order.find()
    .populate('user', 'email')
    .sort({ createdAt: -1 })
    .lean();
  res.json(orders.map(serializeOrder));
});

// @route   PUT /api/orders/:id/status  (ADMIN)
router.put('/:id/status', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  const status = cleanString(req.body.status).toUpperCase();

  if (!Order.STATUSES.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${Order.STATUSES.join(', ')}` });
  }

  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  res.json({ message: 'Order status updated', order: serializeOrder(order.toObject()) });
});

module.exports = router;
