const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Vendor = require('../models/Vendor');
const CartItem = require('../models/CartItem');
const WishlistItem = require('../models/WishlistItem');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const { uploadLimiter } = require('../middleware/security');
const { upload, deleteCloudinaryImages, deleteUploadedFiles } = require('../utils/cloudinary');
const { serializeCategory, serializeProduct } = require('../utils/serializers');
const { isId, cleanString, parsePositiveNumber, parseNonNegativeInt } = require('../utils/helpers');

// Multipart forms sometimes send '', 'null' or 'undefined' for empty selects
const normalizeRef = (v) => (v === undefined || v === null || v === '' || v === 'null' || v === 'undefined' ? null : v);

const parseStringList = (value) => {
  if (value === undefined || value === null || value === '') return [];
  let values = value;
  if (typeof value === 'string') {
    try {
      values = JSON.parse(value);
    } catch {
      values = value.split(',');
    }
  }
  if (!Array.isArray(values)) return null;
  const cleaned = [...new Set(values.map((item) => cleanString(item)).filter(Boolean))];
  return cleaned.length <= 40 && cleaned.every((item) => item.length <= 40) ? cleaned : null;
};

// Validates + normalises the product form fields shared by create & update
const parseProductBody = async (body) => {
  const name = cleanString(body.name);
  const description = cleanString(body.description);
  const price = parsePositiveNumber(body.price);
  const stock = parseNonNegativeInt(body.stock);
  const colors = parseStringList(body.colors);
  const sizes = parseStringList(body.sizes);
  const boxPrice = parseNonNegativeNumber(body.box_price ?? 0);
  const compareAtPrice = body.compare_at_price === undefined || body.compare_at_price === ''
    ? null
    : parseNonNegativeNumber(body.compare_at_price);
  const category = normalizeRef(body.category_id);
  const vendor = normalizeRef(body.vendor_id);
  const isDigital = body.is_digital === true || body.is_digital === 'true';

  if (!name || !description || price === null || stock === null || colors === null || sizes === null || boxPrice === null ||
    (body.compare_at_price !== undefined && body.compare_at_price !== '' && compareAtPrice === null) ||
    (compareAtPrice !== null && compareAtPrice <= price)) {
    return { error: 'Name, description, a valid price and a valid stock quantity are required.' };
  }
  if (category !== null && (!isId(category) || !(await Category.exists({ _id: category })))) {
    return { error: 'Selected category does not exist.' };
  }
  if (vendor !== null && (!isId(vendor) || !(await Vendor.exists({ _id: vendor })))) {
    return { error: 'Selected vendor does not exist.' };
  }
  return { data: { name, description, price, compareAtPrice, stock, colors, sizes, boxPrice, isDigital, category, vendor } };
};

const toImages = (files = []) => files.map((f) => ({ url: f.path, publicId: f.filename, isPrimary: false }));

// ==========================================
// 🗂️ CATEGORY ENDPOINTS
// ==========================================

// @route   POST /api/products/categories  (ADMIN)
router.post('/categories', verifyToken, verifyAdmin, async (req, res) => {
  const name = cleanString(req.body.name);
  const slug = cleanString(req.body.slug).toLowerCase();

  if (!name || !slug) {
    return res.status(400).json({ message: 'Category name and slug are required.' });
  }

  const category = await Category.create({ name, slug });
  res.status(201).json(serializeCategory(category));
});

// @route   GET /api/products/categories  (PUBLIC)
router.get('/categories', async (req, res) => {
  const categories = await Category.find().sort({ name: 1 }).lean();
  res.json(categories.map(serializeCategory));
});

// @route   PUT /api/products/categories/:id  (ADMIN)
router.put('/categories/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  const name = cleanString(req.body.name);
  const slug = cleanString(req.body.slug).toLowerCase();

  if (!name || !slug) {
    return res.status(400).json({ message: 'Category name and slug are required.' });
  }

  const category = await Category.findByIdAndUpdate(req.params.id, { name, slug }, { new: true, runValidators: true });
  if (!category) return res.status(404).json({ message: 'Category not found' });

  res.json(serializeCategory(category));
});

// @route   DELETE /api/products/categories/:id  (ADMIN)
router.delete('/categories/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  // Mongo has no foreign keys, so enforce the "category must be empty" rule here
  if (await Product.exists({ category: req.params.id })) {
    return res.status(400).json({ message: 'Cannot delete category because it contains products.' });
  }

  const deleted = await Category.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Category not found' });

  res.json({ message: 'Category deleted successfully' });
});

// @route   GET /api/products/category/:slug  (PUBLIC)
router.get('/category/:slug', async (req, res) => {
  const category = await Category.findOne({ slug: cleanString(req.params.slug).toLowerCase() }).lean();
  if (!category) return res.json({ categoryName: 'Category', products: [] });

  const products = await Product.find({ category: category._id })
    .populate('category', 'name slug')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ categoryName: category.name, products: products.map((p) => serializeProduct(p)) });
});

// ==========================================
// 🖼️ IMAGE DELETION ENDPOINT
// ==========================================

// @route   DELETE /api/products/images/:image_id  (ADMIN)
router.delete('/images/:image_id', verifyToken, verifyAdmin, validateObjectId('image_id'), async (req, res) => {
  const product = await Product.findOne({ 'images._id': req.params.image_id });
  if (!product) return res.status(404).json({ message: 'Image not found' });

  const image = product.images.id(req.params.image_id);
  const publicId = image.publicId;

  product.images.pull(req.params.image_id);
  product.ensurePrimaryImage(); // promote another image if the primary was removed
  await product.save();
  await deleteCloudinaryImages([publicId]);

  res.json({ message: 'Image successfully removed from gallery' });
});

// ==========================================
// 📦 PRODUCT ENDPOINTS
// ==========================================

// @route   POST /api/products  (ADMIN)
router.post('/', verifyToken, verifyAdmin, uploadLimiter, upload.array('productImages', 10), async (req, res) => {
  try {
    const { error, data } = await parseProductBody(req.body);
    if (error) {
      await deleteUploadedFiles(req.files);
      return res.status(400).json({ message: error });
    }

    const product = new Product({ ...data, images: toImages(req.files) });
    product.ensurePrimaryImage(); // first uploaded image becomes primary
    await product.save();
    await product.populate('category', 'name slug');

    res.status(201).json({
      message: 'Product successfully uploaded',
      product: serializeProduct(product.toObject()),
    });
  } catch (err) {
    await deleteUploadedFiles(req.files);
    throw err;
  }
});

// @route   GET /api/products  (PUBLIC)
router.get('/', async (req, res) => {
  const products = await Product.find()
    .populate('category', 'name slug')
    .sort({ createdAt: -1 })
    .lean();
  res.json(products.map((p) => serializeProduct(p)));
});

// @route   GET /api/products/:id  (PUBLIC)
router.get('/:id', validateObjectId('id'), async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name slug')
    .populate('vendor', 'name')
    .lean();

  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(serializeProduct(product, { detailed: true }));
});

// @route   PUT /api/products/:id  (ADMIN) – updates fields and APPENDS new images
router.put('/:id', verifyToken, verifyAdmin, validateObjectId('id'), uploadLimiter, upload.array('productImages', 10), async (req, res) => {
  try {
    const { error, data } = await parseProductBody(req.body);
    if (error) {
      await deleteUploadedFiles(req.files);
      return res.status(400).json({ message: error });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      await deleteUploadedFiles(req.files);
      return res.status(404).json({ message: 'Product not found' });
    }

    product.set(data);
    toImages(req.files).forEach((img) => product.images.push(img));
    product.ensurePrimaryImage();
    await product.save();
    await product.populate('category', 'name slug');

    res.json(serializeProduct(product.toObject()));
  } catch (err) {
    await deleteUploadedFiles(req.files);
    throw err;
  }
});

// @route   DELETE /api/products/:id  (ADMIN)
router.delete('/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  // Clean up everything that pointed at the product (old orders keep their own snapshot)
  await Promise.all([
    CartItem.deleteMany({ product: product._id }),
    WishlistItem.deleteMany({ product: product._id }),
    deleteCloudinaryImages(product.images.map((i) => i.publicId)),
  ]);

  res.json({ message: 'Product deleted successfully' });
});

module.exports = router;
