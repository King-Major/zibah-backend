const mongoose = require('mongoose');

// Images live INSIDE the product document (replaces the product_images table)
const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String }, // Cloudinary public_id, needed to delete the file later
  isPrimary: { type: Boolean, default: false },
});

const productSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    isDigital: { type: Boolean, default: false },
    images: [imageSchema],
  },
  { timestamps: true }
);

productSchema.index({ createdAt: -1 });

// Guarantees exactly one primary image whenever the product has images
productSchema.methods.ensurePrimaryImage = function ensurePrimaryImage() {
  if (!this.images.length) return;
  const primaries = this.images.filter((img) => img.isPrimary);
  if (primaries.length === 0) {
    this.images[0].isPrimary = true;
  } else if (primaries.length > 1) {
    primaries.slice(1).forEach((img) => { img.isPrimary = false; });
  }
};

module.exports = mongoose.model('Product', productSchema);
