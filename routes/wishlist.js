const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// @route   POST /api/wishlist
// @desc    Add item to wishlist
router.post('/', verifyToken, async (req, res) => {
  const { product_id } = req.body;
  const user_id = req.user.id;

  if (!product_id) {
    return res.status(400).json({ message: 'A valid product id is required.' });
  }

  try {
    await db.query(
      `INSERT INTO wishlist (user_id, product_id) 
       VALUES ($1, $2) 
       ON CONFLICT DO NOTHING 
       RETURNING *`,
      [user_id, product_id]
    );
    
    res.status(200).json({ message: 'Added to wishlist' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error adding to wishlist');
  }
});

// @route   GET /api/wishlist
// @desc    Get current user's wishlist
router.get('/', verifyToken, async (req, res) => {
  const user_id = req.user.id;

  try {
    const queryText = `
      SELECT w.id as wishlist_id, p.id as product_id, p.name, p.price, pi.image_url
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
      WHERE w.user_id = $1
    `;
    const wishlist = await db.query(queryText, [user_id]);
    res.json(wishlist.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching wishlist');
  }
});

// @route   DELETE /api/wishlist/:product_id
// @desc    Remove an item from the wishlist
router.delete('/:product_id', verifyToken, async (req, res) => {
  const { product_id } = req.params;
  const user_id = req.user.id;

  try {
    await db.query('DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2', [user_id, product_id]);
    res.json({ message: 'Item removed from wishlist' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error removing wishlist item');
  }
});

module.exports = router;