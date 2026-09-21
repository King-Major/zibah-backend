const crypto = require('crypto');
const axios = require('axios');
const Order = require('../models/Order');
const Product = require('../models/Product');
const CartItem = require('../models/CartItem');
const User = require('../models/User');
const { processPostPaymentEmails } = require('./orderEmails');

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({ Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` });

const initializePaystackTransaction = async (payload) => {
  const { data } = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, payload, {
    headers: { ...paystackHeaders(), 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  return data.data; // { authorization_url, access_code, reference }
};

const fetchPaystackTransaction = async (reference) => {
  const { data } = await axios.get(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: paystackHeaders(), timeout: 15000 }
  );
  return data.data;
};

// Paystack signs the raw webhook body with HMAC-SHA512 using your secret key
const isValidWebhookSignature = (rawBody, signature) => {
  if (!rawBody || !signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Runs exactly once per order (guarded by the atomic PENDING -> PAID switch below)
const runPostPaymentSideEffects = async (order) => {
  // 1. Decrement stock for physical products
  try {
    for (const item of order.items) {
      if (item.isDigital) continue;
      const result = await Product.updateOne(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );
      if (result.modifiedCount === 0) {
        console.warn(`⚠️ Stock shortfall for product ${item.product} on order ${order._id}`);
      }
    }
  } catch (err) {
    console.error('Stock update failed:', err.message);
  }

  // 2. Remove only the purchased products from the buyer's cart
  try {
    await CartItem.deleteMany({ user: order.user, product: { $in: order.items.map((i) => i.product) } });
  } catch (err) {
    console.error('Cart cleanup failed:', err.message);
  }

  // 3. Emails (fire-and-forget; processPostPaymentEmails never throws)
  try {
    const user = await User.findById(order.user).select('email');
    if (user) processPostPaymentEmails(order, user.email);
  } catch (err) {
    console.error('Post-payment email lookup failed:', err.message);
  }
};

/**
 * Confirms a payment with Paystack and marks the order PAID.
 * Safe to call any number of times / from both the /verify route and the webhook:
 * only the first successful call performs side effects.
 * Returns { paid: boolean, order }.
 */
const confirmPayment = async (reference) => {
  const order = await Order.findOne({ paystackRef: reference });
  if (!order) return { paid: false, order: null };
  if (order.status !== 'PENDING') return { paid: !!order.paidAt, order };

  const tx = await fetchPaystackTransaction(reference);
  if (tx.status !== 'success') return { paid: false, order };

  // Never trust status alone – make sure the amount really matches this order
  const expectedKobo = Math.round(order.totalAmount * 100);
  if (tx.amount !== expectedKobo || (tx.currency && tx.currency !== 'NGN')) {
    console.error(`❌ Amount mismatch on ${reference}: expected ${expectedKobo}, got ${tx.amount} ${tx.currency}`);
    return { paid: false, order };
  }

  const fulfilled = await Order.findOneAndUpdate(
    { _id: order._id, status: 'PENDING' },
    { $set: { status: 'PAID', paidAt: new Date() } },
    { new: true }
  );

  if (!fulfilled) {
    // Someone else (webhook vs. verify) got there first
    const fresh = await Order.findById(order._id);
    return { paid: !!fresh?.paidAt, order: fresh };
  }

  await runPostPaymentSideEffects(fulfilled);
  return { paid: true, order: fulfilled };
};

module.exports = { initializePaystackTransaction, confirmPayment, isValidWebhookSignature };
