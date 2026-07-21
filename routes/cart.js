const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// @route   POST /api/cart
// @desc    Add item to cart or update quantity (SIGNED IN USERS)
router.post('/', verifyToken, async (req, res) => {
  const { product_id, quantity } = req.body;
  const user_id = req.user.id;
  const parsedQuantity = Number(quantity || 1);

  if (!product_id || !Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
    return res.status(400).json({ message: 'A valid product id and positive quantity are required.' });
  }

  try {
    const cartItem = await db.query(
      `INSERT INTO cart (user_id, product_id, quantity) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id, product_id) 
       DO UPDATE SET quantity = cart.quantity + EXCLUDED.quantity 
       RETURNING *`,
      [user_id, product_id, parsedQuantity]
    );
    
    res.status(200).json(cartItem.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error adding to cart');
  }
});

// @route   GET /api/cart
// @desc    Get current user's cart with product details
router.get('/', verifyToken, async (req, res) => {
  const user_id = req.user.id;

  try {
    // This query uses your separate product_images table (Table 6)
    // and aliases the columns exactly as Zustand expects them.
    const queryText = `
      SELECT 
        p.id, 
        c.quantity, 
        p.name, 
        p.price, 
        c.id as cart_id,
        pi.image_url as primary_image
      FROM cart c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
      WHERE c.user_id = $1
    `;
    const cart = await db.query(queryText, [user_id]);
    res.json(cart.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching cart');
  }
});

// @route   DELETE /api/cart/:product_id
// @desc    Remove an item from the cart
router.delete('/:product_id', verifyToken, async (req, res) => {
  const { product_id } = req.params;
  const user_id = req.user.id;

  try {
    await db.query('DELETE FROM cart WHERE user_id = $1 AND product_id = $2', [user_id, product_id]);
    res.json({ message: 'Item removed from cart' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error removing cart item');
  }
});

module.exports = router;