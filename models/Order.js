const mongoose = require('mongoose');

// Adjust this list to match the statuses your admin dashboard uses
const STATUSES = [
  'PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'READY_FOR_PICKUP',
  'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED',
];

// Order items are embedded snapshots: they keep the name/price/image as they
// were at purchase time, even if the product is edited or deleted later.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    name: { type: String, required: true },
    isDigital: { type: Boolean, default: false },
    quantity: { type: Number, required: true, min: 1 },
    priceAtPurchase: { type: Number, required: true, min: 0 },
    color: { type: String, default: '' },
    size: { type: String, default: '' },
    boxed: { type: Boolean, default: false },
    boxPriceAtPurchase: { type: Number, default: 0, min: 0 },
    image: { type: String, default: null },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'PickupLocation', default: null },
    locationSnapshot: { name: String, address: String, addedFee: Number },
    items: {
      type: [orderItemSchema],
      validate: [(v) => v.length > 0, 'An order must contain at least one item'],
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: STATUSES, default: 'PENDING', index: true },
    paystackRef: { type: String, required: true, unique: true },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
Order.STATUSES = STATUSES;

module.exports = Order;
