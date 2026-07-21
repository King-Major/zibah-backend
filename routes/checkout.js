const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/security');
const { processPostPaymentEmails } = require('../services/orderEmails');

const parsePositiveNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};
// @route   GET /api/checkout/locations
// @desc    Get all active pickup locations and their fees
router.get('/locations', async (req, res) => {
  try {
    const locations = await db.query('SELECT * FROM pickup_locations ORDER BY added_fee ASC');
    res.json(locations.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching locations');
  }
});

// @route   POST /api/checkout/locations
// @desc    Add a new pickup location (ADMIN ONLY)
router.post('/locations', verifyToken, async (req, res) => {
  const { name, address, added_fee } = req.body;
  const parsedFee = parsePositiveNumber(added_fee);

  if (!name || !address || parsedFee === null) {
    return res.status(400).json({ message: 'Location name, address, and a valid added fee are required.' });
  }

  try {
    const newLoc = await db.query(
      `INSERT INTO pickup_locations (name, address, added_fee) VALUES ($1, $2, $3) RETURNING *`,
      [String(name).trim(), String(address).trim(), parsedFee]
    );
    res.json(newLoc.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error adding location');
  }
});

// @route   PUT /api/checkout/locations/:id
// @desc    Update a pickup location (ADMIN ONLY)
router.put('/locations/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { name, address, added_fee } = req.body;
  const parsedFee = parsePositiveNumber(added_fee);

  if (!name || !address || parsedFee === null) {
    return res.status(400).json({ message: 'Location name, address, and a valid added fee are required.' });
  }

  try {
    const updatedLoc = await db.query(
      `UPDATE pickup_locations SET name = $1, address = $2, added_fee = $3 WHERE id = $4 RETURNING *`,
      [String(name).trim(), String(address).trim(), parsedFee, id]
    );
    if (updatedLoc.rows.length === 0) return res.status(404).json({ message: 'Location not found' });
    res.json(updatedLoc.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error updating location');
  }
});

// @route   DELETE /api/checkout/locations/:id
// @desc    Delete a pickup location (ADMIN ONLY)
router.delete('/locations/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM pickup_locations WHERE id = $1`, [id]);
    res.json({ message: 'Location deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error deleting location');
  }
});

// @route   POST /api/checkout/initialize
// @desc    Calculate total, create order, and get Paystack payment link
router.post('/initialize', verifyToken, authLimiter, async (req, res) => {
  const { location_id } = req.body;
  const user_id = req.user.id;

  if (!location_id) {
    return res.status(400).json({ message: 'A valid pickup location is required.' });
  }

  try {
    // 1. Fetch user email for Paystack
    const userRes = await db.query('SELECT email FROM users WHERE id = $1', [user_id]);
    const email = userRes.rows[0].email;

    // 2. Fetch the cart and calculate the subtotal
    const cartRes = await db.query(`
      SELECT c.quantity, p.id as product_id, p.price, p.vendor_id 
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1
    `, [user_id]);

    if (cartRes.rows.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    let subtotal = 0;
    cartRes.rows.forEach(item => {
      subtotal += (parseFloat(item.price) * item.quantity);
    });

    // 3. Fetch the location fee
    const locationRes = await db.query('SELECT added_fee FROM pickup_locations WHERE id = $1', [location_id]);
    if (locationRes.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid pickup location' });
    }
    const deliveryFee = parseFloat(locationRes.rows[0].added_fee);

    // 4. Calculate Final Total (Amount to charge)
    const finalTotal = subtotal + deliveryFee;

    // 5. Initialize transaction with Paystack (Amount must be in kobo, so * 100)
    const paystackAmount = Math.round(finalTotal * 100); 
    
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: email,
        amount: paystackAmount,
        callback_url: 'http://localhost:5173/verify', // Your React frontend URL
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { authorization_url, reference } = paystackResponse.data.data;

    // 6. Create the Order in the database as 'PENDING'
    const orderRes = await db.query(
      `INSERT INTO orders (user_id, location_id, total_amount, status, paystack_ref) 
       VALUES ($1, $2, $3, 'PENDING', $4) RETURNING id`,
      [user_id, location_id, finalTotal, reference]
    );
    const orderId = orderRes.rows[0].id;

    // 7. Move items from Cart to Order Items
    const orderItemsQueries = cartRes.rows.map(item => {
      return db.query(
        `INSERT INTO order_items (order_id, product_id, vendor_id, quantity, price_at_purchase) 
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.product_id, item.vendor_id, item.quantity, item.price]
      );
    });
    await Promise.all(orderItemsQueries);

    // 8. Clear the user's cart
    await db.query('DELETE FROM cart WHERE user_id = $1', [user_id]);

    // 9. Send the payment link back to the React frontend
    res.json({
      message: 'Checkout initialized successfully',
      authorization_url,
      reference,
      order_id: orderId
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error during checkout initialization');
  }
});

// @route   POST /api/checkout/verify
// @desc    Verify payment with Paystack and update order status
router.post('/verify', verifyToken, authLimiter, async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    return res.status(400).json({ message: 'A payment reference is required.' });
  }

  try {
    // 1. Ask Paystack if the transaction was successful
    const verifyResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paystackData = verifyResponse.data.data;

  if (paystackData.status === 'success') {
      // 2. Update the order status to PAID
      const updatedOrder = await db.query(
        `UPDATE orders SET status = 'PAID' WHERE paystack_ref = $1 RETURNING *`,
        [reference]
      );
      
      const order = updatedOrder.rows[0];

      // 3. Fetch customer email to send the download links
      const userRes = await db.query('SELECT email FROM users WHERE id = $1', [order.user_id]);
      const customerEmail = userRes.rows[0].email;

      // 4. FIRE THE AUTOMATED EMAIL WEBHOOK (Runs asynchronously in the background)
      processPostPaymentEmails(order.id, customerEmail);

      res.json({ 
        message: 'Payment successful, order confirmed.',
        order: order
      });
    } else {
      // If payment failed or is abandoned
      res.status(400).json({ message: 'Payment verification failed or is incomplete' });
    }

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error verifying payment');
  }
});


// TEMPORARY ROUTE: GET /api/checkout/seed-locations
// router.get('/seed-locations', async (req, res) => {
//   try {
//     await db.query('TRUNCATE TABLE pickup_locations RESTART IDENTITY CASCADE');
    
//     const query = `
//       INSERT INTO pickup_locations (name, address, added_fee) VALUES
//       ('Within UNILAG', 'University of Lagos Campus Area', 300.00),
//       ('Within YABATECH', 'Yaba College of Technology Campus Area', 300.00),
//       ('Abule Oja', 'Abule Oja and Environs', 600.00),
//       ('Chemist & Pako', 'Chemist / Pako Bus Stop Area', 1000.00),
//       ('Bariga', 'Bariga and Environs', 1200.00),
//       ('Shomolu', 'Shomolu and Environs', 1500.00)
//     `;
    
//     await db.query(query);
//     res.json({ message: 'Real locations successfully seeded!' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send('Error seeding locations');
//   }
// });

module.exports = router;