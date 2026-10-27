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
  const color = typeof req.body.color === 'string' ? req.body.color.trim() : '';
  const size = typeof req.body.size === 'string' ? req.body.size.trim() : '';
  const quantity = Number(req.body.quantity ?? 1);

  if (!isId(product_id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return res.status(400).json({ message: 'A valid product id and positive quantity are required.' });
  }

  const product = await Product.findById(product_id).select('colors sizes');
  if (!product) return res.status(404).json({ message: 'Product not found' });
  if ((product.colors.length && !product.colors.includes(color)) || (!product.colors.length && color)) {
    return res.status(400).json({ message: 'Choose a valid product color.' });
  }
  if ((product.sizes.length && !product.sizes.includes(size)) || (!product.sizes.length && size)) {
    return res.status(400).json({ message: 'Choose a valid product size.' });
  }

  // Single atomic upsert (unique index on user+product prevents duplicates)
  const item = await CartItem.findOneAndUpdate(
    { user: req.user.id, product: product_id, color, size },
    { $inc: { quantity }, $setOnInsert: { color, size } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({ id: idOf(item), user_id: idOf(item.user), product_id: idOf(item.product), quantity: item.quantity, color, size });
});

// @route   GET /api/cart
// @desc    Current user's cart with product details
router.get('/', verifyToken, async (req, res) => {
  const items = await CartItem.find({ user: req.user.id })
    .populate('product', 'name price compareAtPrice boxPrice images')
    .lean();

  // Skip rows whose product was deleted in the meantime
  res.json(items.filter((i) => i.product).map(serializeCartItem));
});

// @route   DELETE /api/cart/:product_id
router.delete('/:cart_item_id', verifyToken, validateObjectId('cart_item_id'), async (req, res) => {
  await CartItem.deleteOne({ user: req.user.id, _id: req.params.cart_item_id });
  res.json({ message: 'Item removed from cart' });
});

module.exports = router;
