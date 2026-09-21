const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const { serializeVendor } = require('../utils/serializers');
const { cleanString, isValidEmail } = require('../utils/helpers');

const parseVendorBody = (body) => {
  const name = cleanString(body.name);
  const email = cleanString(body.email).toLowerCase();
  const companyName = cleanString(body.company_name);
  if (!name || !email || !companyName || !isValidEmail(email)) return null;
  return { name, email, companyName };
};

// @route   POST /api/vendors  (ADMIN)
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  const data = parseVendorBody(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Vendor name, a valid email, and company name are required.' });
  }

  const vendor = await Vendor.create(data);
  res.status(201).json({ message: 'Vendor added successfully', vendor: serializeVendor(vendor) });
});

// @route   GET /api/vendors  (ADMIN)
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  const vendors = await Vendor.find().sort({ createdAt: -1 }).lean();
  res.json(vendors.map(serializeVendor));
});

// @route   PUT /api/vendors/:id  (ADMIN)
router.put('/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  const data = parseVendorBody(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Vendor name, a valid email, and company name are required.' });
  }

  const vendor = await Vendor.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  res.json(serializeVendor(vendor));
});

// @route   DELETE /api/vendors/:id  (ADMIN)
router.delete('/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  if (await Product.exists({ vendor: req.params.id })) {
    return res.status(400).json({ message: 'Cannot delete vendor while products are assigned to them. Reassign those products first.' });
  }

  const vendor = await Vendor.findByIdAndDelete(req.params.id);
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  res.json({ message: 'Vendor deleted successfully' });
});

module.exports = router;
