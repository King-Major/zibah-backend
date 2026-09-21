const express = require('express');
const router = express.Router();
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const { verifyToken } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const { serializeCartItem, idOf } = require('../utils/serializers');
const { isId } = require('../utils/helpers');

// @route   POST /api/cart
// @desc    Add item to cart or increase quantity
router.post('/', verifyToken, async (req, res) => {
  const { product_id } = req.body;
  const quantity = Number(req.body.quantity ?? 1);

  if (!isId(product_id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return res.status(400).json({ message: 'A valid product id and positive quantity are required.' });
  }

  if (!(await Product.exists({ _id: product_id }))) {
    return res.status(404).json({ message: 'Product not found' });
  }

  // Single atomic upsert (unique index on user+product prevents duplicates)
  const item = await CartItem.findOneAndUpdate(
    { user: req.user.id, product: product_id },
    { $inc: { quantity } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({ id: idOf(item), user_id: idOf(item.user), product_id: idOf(item.product), quantity: item.quantity });
});

// @route   GET /api/cart
// @desc    Current user's cart with product details
router.get('/', verifyToken, async (req, res) => {
  const items = await CartItem.find({ user: req.user.id })
    .populate('product', 'name price images')
    .lean();

  // Skip rows whose product was deleted in the meantime
  res.json(items.filter((i) => i.product).map(serializeCartItem));
});

// @route   DELETE /api/cart/:product_id
router.delete('/:product_id', verifyToken, validateObjectId('product_id'), async (req, res) => {
  await CartItem.deleteOne({ user: req.user.id, product: req.params.product_id });
  res.json({ message: 'Item removed from cart' });
});

module.exports = router;
