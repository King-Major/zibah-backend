const express = require('express');
const router = express.Router();
const WishlistItem = require('../models/WishlistItem');
const Product = require('../models/Product');
const { verifyToken } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const { serializeWishlistItem } = require('../utils/serializers');
const { isId } = require('../utils/helpers');

// @route   POST /api/wishlist
router.post('/', verifyToken, async (req, res) => {
  const { product_id } = req.body;

  if (!isId(product_id)) {
    return res.status(400).json({ message: 'A valid product id is required.' });
  }
  if (!(await Product.exists({ _id: product_id }))) {
    return res.status(404).json({ message: 'Product not found' });
  }

  // Upsert = "ON CONFLICT DO NOTHING"
  try {
    await WishlistItem.updateOne(
      { user: req.user.id, product: product_id },
      { $setOnInsert: { user: req.user.id, product: product_id } },
      { upsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err; // concurrent double-click: already added
  }

  res.status(200).json({ message: 'Added to wishlist' });
});

// @route   GET /api/wishlist
router.get('/', verifyToken, async (req, res) => {
  const items = await WishlistItem.find({ user: req.user.id })
    .populate('product', 'name price images')
    .sort({ createdAt: -1 })
    .lean();

  res.json(items.filter((i) => i.product).map(serializeWishlistItem));
});

// @route   DELETE /api/wishlist/:product_id
router.delete('/:product_id', verifyToken, validateObjectId('product_id'), async (req, res) => {
  await WishlistItem.deleteOne({ user: req.user.id, product: req.params.product_id });
  res.json({ message: 'Item removed from wishlist' });
});

module.exports = router;
