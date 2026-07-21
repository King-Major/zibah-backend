const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// @route   GET /api/orders/me
// @desc    Get all orders for the logged-in customer
router.get('/me', verifyToken, async (req, res) => {
  try {
    // 1. Fetch the user's orders
    const ordersRes = await db.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    
    const orders = ordersRes.rows;

    // 2. Attach the specific items to each order
    for (let order of orders) {
      const itemsRes = await db.query(
        `SELECT oi.quantity, oi.price_at_purchase, p.name, p.is_digital, pi.image_url as primary_image
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
         WHERE oi.order_id = $1`,
        [order.id]
      );
      order.items = itemsRes.rows;
    }

    res.json(orders);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching user orders');
  }
});


// @route   GET /api/orders/all
// @desc    Get all orders for the Admin Dashboard (ADMIN ONLY)
router.get('/all', verifyToken, async (req, res) => {
  // Optional: Enforce Admin Role (if req.user.role exists)
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }

  try {
    const ordersRes = await db.query(`
      SELECT o.*, u.email as customer_email, pl.name as pickup_location 
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN pickup_locations pl ON o.location_id = pl.id
      ORDER BY o.created_at DESC
    `);
    
    const orders = ordersRes.rows;

    // Attach items to each order
    for (let order of orders) {
      const itemsRes = await db.query(
        `SELECT oi.quantity, oi.price_at_purchase, p.name, p.is_digital 
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [order.id]
      );
      order.items = itemsRes.rows;
    }

    res.json(orders);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching all orders');
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status (ADMIN ONLY)
router.put('/:id/status', verifyToken, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }

  const { status } = req.body;
  const orderId = req.params.id;

  try {
    const updatedOrder = await db.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, orderId]
    );

    if (updatedOrder.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ message: 'Order status updated', order: updatedOrder.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error updating order status');
  }
});

module.exports = router;