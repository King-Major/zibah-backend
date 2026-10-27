const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const PickupLocation = require('../models/PickupLocation');
const CartItem = require('../models/CartItem');
const Order = require('../models/Order');
const User = require('../models/User');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const { authLimiter } = require('../middleware/security');
const { initializePaystackTransaction, confirmPayment, isValidWebhookSignature } = require('../services/payment');
const { serializeLocation, serializeOrder } = require('../utils/serializers');
const { isId, cleanString, parseNonNegativeNumber } = require('../utils/helpers');

const parseLocationBody = (body) => {
  const name = cleanString(body.name);
  const address = cleanString(body.address);
  const addedFee = parseNonNegativeNumber(body.added_fee);
  if (!name || !address || addedFee === null) return null;
  return { name, address, addedFee };
};

// ==========================================
// 📍 PICKUP LOCATIONS
// ==========================================

// @route   GET /api/checkout/locations  (PUBLIC)
router.get('/locations', async (req, res) => {
  const locations = await PickupLocation.find().sort({ addedFee: 1 }).lean();
  res.json(locations.map(serializeLocation));
});

// @route   POST /api/checkout/locations  (ADMIN)
router.post('/locations', verifyToken, verifyAdmin, async (req, res) => {
  const data = parseLocationBody(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Location name, address, and a valid added fee are required.' });
  }
  const location = await PickupLocation.create(data);
  res.status(201).json(serializeLocation(location));
});

// @route   PUT /api/checkout/locations/:id  (ADMIN)
router.put('/locations/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  const data = parseLocationBody(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Location name, address, and a valid added fee are required.' });
  }
  const location = await PickupLocation.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!location) return res.status(404).json({ message: 'Location not found' });
  res.json(serializeLocation(location));
});

// @route   DELETE /api/checkout/locations/:id  (ADMIN)
router.delete('/locations/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  await PickupLocation.findByIdAndDelete(req.params.id);
  res.json({ message: 'Location deleted successfully' });
});

// ==========================================
// 💳 PAYMENT
// ==========================================

// @route   POST /api/checkout/initialize
// @desc    Price the cart on the server, create a PENDING order, get a Paystack link
router.post('/initialize', verifyToken, authLimiter, async (req, res) => {
  const { location_id } = req.body;
  if (!isId(location_id)) {
    return res.status(400).json({ message: 'A valid pickup location is required.' });
  }

  const [user, location, cartItems] = await Promise.all([
    User.findById(req.user.id).select('name whatsappNumber email'),
    PickupLocation.findById(location_id),
    CartItem.find({ user: req.user.id }).populate('product'),
  ]);

  if (!user) return res.status(401).json({ message: 'Account no longer exists.' });
  if (!location) return res.status(400).json({ message: 'Invalid pickup location' });

  const liveItems = cartItems.filter((ci) => ci.product); // ignore products deleted after being carted
  if (liveItems.length === 0) return res.status(400).json({ message: 'Cart is empty' });

  const submittedChoices = Array.isArray(req.body.cartItems) ? req.body.cartItems : [];
  if (submittedChoices.some((choice) => !choice || !isId(choice.cart_id) || typeof choice.boxed !== 'boolean')) {
    return res.status(400).json({ message: 'Invalid boxing selection.' });
  }
  const boxingChoices = new Map(submittedChoices.map((choice) => [choice.cart_id, choice.boxed]));
  if (submittedChoices.length !== boxingChoices.size || submittedChoices.some((choice) =>
    !liveItems.some((item) => String(item._id) === choice.cart_id)
  )) {
    return res.status(400).json({ message: 'Invalid cart item in boxing selection.' });
  }

  // Build order items from DB prices (never from the client) and check stock
  const orderItems = [];
  let subtotalKobo = 0;
  for (const ci of liveItems) {
    const p = ci.product;
    if ((p.colors.length && !p.colors.includes(ci.color)) || (p.sizes.length && !p.sizes.includes(ci.size))) {
      return res.status(400).json({ message: `Please update the color or size selection for "${p.name}".` });
    }
    const boxed = boxingChoices.get(String(ci._id)) === true;
    if (boxed && !(p.boxPrice > 0)) {
      return res.status(400).json({ message: `Boxing is not available for "${p.name}".` });
    }
    if (!p.isDigital && p.stock < ci.quantity) {
      return res.status(400).json({
        message: p.stock > 0 ? `Only ${p.stock} of "${p.name}" left in stock.` : `"${p.name}" is out of stock.`,
      });
    }
    const primary = p.images.find((i) => i.isPrimary) || p.images[0];
    const boxPriceAtPurchase = boxed ? p.boxPrice : 0;
    subtotalKobo += Math.round(p.price * 100) * ci.quantity + Math.round(boxPriceAtPurchase * 100) * ci.quantity;
    orderItems.push({
      product: p._id,
      vendor: p.vendor || null,
      name: p.name,
      isDigital: p.isDigital,
      quantity: ci.quantity,
      priceAtPurchase: p.price,
      color: ci.color || '',
      size: ci.size || '',
      boxed,
      boxPriceAtPurchase,
      image: primary ? primary.url : null,
    });
  }

  const deliveryKobo = Math.round(location.addedFee * 100);
  const totalKobo = subtotalKobo + deliveryKobo; // integer maths avoids float drift
  const reference = `ZIB-${crypto.randomBytes(10).toString('hex')}`;

  // Create the order first so the webhook can always find it
  const order = await Order.create({
    user: user._id,
    location: location._id,
    locationSnapshot: { name: location.name, address: location.address, addedFee: location.addedFee },
    items: orderItems,
    subtotal: subtotalKobo / 100,
    deliveryFee: deliveryKobo / 100,
    totalAmount: totalKobo / 100,
    status: 'PENDING',
    paystackRef: reference,
  });

  try {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const customerFields = [];
    if (user.name) {
      customerFields.push({ display_name: 'Customer Name', variable_name: 'customer_name', value: user.name });
    }
    if (user.whatsappNumber) {
      customerFields.push({
        display_name: 'WhatsApp Number',
        variable_name: 'whatsapp_number',
        value: user.whatsappNumber,
      });
    }

    const tx = await initializePaystackTransaction({
      email: user.email,
      amount: totalKobo, // Paystack expects kobo
      currency: 'NGN',
      reference,
      callback_url: `${frontendUrl}/verify`,
      metadata: {
        order_id: String(order._id),
        ...(user.name ? { customer_name: user.name } : {}),
        ...(user.whatsappNumber ? { whatsapp_number: user.whatsappNumber } : {}),
        ...(customerFields.length > 0 ? { custom_fields: customerFields } : {}),
      },
    });

    res.json({
      message: 'Checkout initialized successfully',
      authorization_url: tx.authorization_url,
      reference,
      order_id: order.id,
    });
  } catch (err) {
    await Order.deleteOne({ _id: order._id });
    console.error('Paystack initialize failed:', err.response?.data || err.message);
    res.status(502).json({ message: 'Could not start the payment. Please try again.' });
  }
});

// @route   POST /api/checkout/verify
// @desc    Called by the frontend after Paystack redirects back
router.post('/verify', verifyToken, authLimiter, async (req, res) => {
  const reference = cleanString(req.body.reference);
  if (!reference) {
    return res.status(400).json({ message: 'A payment reference is required.' });
  }

  // Users may only verify their OWN orders
  const owned = await Order.exists({ paystackRef: reference, user: req.user.id });
  if (!owned) return res.status(404).json({ message: 'No order found for this payment reference.' });

  const { paid, order } = await confirmPayment(reference);
  if (!paid) {
    return res.status(400).json({ message: 'Payment verification failed or is incomplete' });
  }

  res.json({
    message: 'Payment successful, order confirmed.',
    order: serializeOrder(order.toObject()),
  });
});

// @route   POST /api/checkout/webhook
// @desc    Paystack server-to-server notification (set this URL in the Paystack dashboard).
//          Confirms orders even if the customer closes the tab before the redirect.
router.post('/webhook', async (req, res) => {
  if (!isValidWebhookSignature(req.rawBody, req.header('x-paystack-signature'))) {
    return res.sendStatus(401);
  }

  const event = req.body;
  if (event?.event === 'charge.success' && typeof event.data?.reference === 'string') {
    try {
      await confirmPayment(event.data.reference);
    } catch (err) {
      console.error('Webhook processing failed:', err.message);
      return res.sendStatus(500); // non-2xx => Paystack retries
    }
  }
  res.sendStatus(200);
});

module.exports = router;
