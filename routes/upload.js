const express = require('express');
const router = express.Router();
const { upload } = require('../utils/cloudinary');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/security');

// @route   POST /api/upload
// @desc    Upload image to Cloudinary and return URL (ADMIN ONLY)
router.post('/', verifyToken, verifyAdmin, uploadLimiter, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image provided' });
    }
    // req.file.path contains the secure Cloudinary URL
    res.json({ imageUrl: req.file.path });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).send('Server error during image upload');
  }
});

module.exports = router;