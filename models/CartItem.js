const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    color: { type: String, default: '' },
    size: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { timestamps: true }
);

// One row per (user, product) – makes "add to cart" a single atomic upsert
cartItemSchema.index({ user: 1, product: 1, color: 1, size: 1 }, { unique: true });

module.exports = mongoose.model('CartItem', cartItemSchema);
