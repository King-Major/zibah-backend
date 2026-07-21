const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/security');

// @route   POST /api/vendors
// @desc    Add a new vendor (ADMIN ONLY)
router.post('/', verifyToken, verifyAdmin, authLimiter, async (req, res) => {
  const { name, email, company_name } = req.body;

  if (!name || !email || !company_name) {
    return res.status(400).json({ message: 'Vendor name, email, and company name are required.' });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const newVendor = await db.query(
      'INSERT INTO vendors (name, email, company_name) VALUES ($1, $2, $3) RETURNING *',
      [String(name).trim(), normalizedEmail, String(company_name).trim()]
    );
    res.status(201).json({
      message: 'Vendor added successfully',
      vendor: newVendor.rows[0]
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error while adding vendor');
  }
});

// @route   GET /api/vendors
// @desc    Get all vendors (ADMIN ONLY)
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const vendors = await db.query('SELECT * FROM vendors ORDER BY created_at DESC');
    res.json(vendors.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching vendors');
  }
});


// @route   PUT /api/vendors/:id
// @desc    Update a vendor (ADMIN ONLY)
router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, company_name } = req.body;

  if (!name || !email || !company_name) {
    return res.status(400).json({ message: 'Vendor name, email, and company name are required.' });
  }

  try {
    const updatedVendor = await db.query(
      `UPDATE vendors SET name = $1, email = $2, company_name = $3 WHERE id = $4 RETURNING *`,
      [String(name).trim(), String(email).trim().toLowerCase(), String(company_name).trim(), id]
    );

    if (updatedVendor.rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json(updatedVendor.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error updating vendor');
  }
});

// @route   DELETE /api/vendors/:id
// @desc    Delete a vendor (ADMIN ONLY)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(`DELETE FROM vendors WHERE id = $1`, [id]);
    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error deleting vendor');
  }
});

module.exports = router;