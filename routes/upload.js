const express = require('express');
const router = express.Router();
const { upload } = require('../utils/cloudinary');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/security');

// @route   POST /api/upload
// @desc    Upload one image to Cloudinary and return its URL (ADMIN)
router.post('/', verifyToken, verifyAdmin, uploadLimiter, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image provided' });
  }
  // req.file.path = secure Cloudinary URL, req.file.filename = Cloudinary public_id
  res.json({ imageUrl: req.file.path, publicId: req.file.filename });
});

module.exports = router;
