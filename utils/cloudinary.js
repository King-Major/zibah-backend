const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'zibah_stores_products',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // 5MB per image, 10 images
});

// Best-effort removal – never throws
const deleteCloudinaryImages = async (publicIds = []) => {
  await Promise.allSettled(
    publicIds.filter(Boolean).map((id) => cloudinary.uploader.destroy(id))
  );
};

// Used when a request fails AFTER multer already uploaded files (avoids orphaned images)
const deleteUploadedFiles = (files) =>
  deleteCloudinaryImages(Array.isArray(files) ? files.map((f) => f.filename) : []);

module.exports = { cloudinary, upload, deleteCloudinaryImages, deleteUploadedFiles };
