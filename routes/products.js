const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/security');
const { upload } = require('../utils/cloudinary.js');

const parsePositiveNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

// ==========================================
// 🗂️ CATEGORY ENDPOINTS
// ==========================================

// @route   POST /api/products/categories
// @desc    Create a new product category (ADMIN ONLY)
router.post('/categories', verifyToken, verifyAdmin, async (req, res) => {
  const { name, slug } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ message: 'Category name and slug are required.' });
  }

  try {
    const newCategory = await db.query(
      'INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING *',
      [String(name).trim(), String(slug).trim().toLowerCase()]
    );
    res.status(201).json(newCategory.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error while creating category' });
  }
});

// @route   GET /api/products/categories
// @desc    Get all categories (PUBLIC - For store navigation)
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(categories.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching categories');
  }
});

// @route   PUT /api/products/categories/:id
// @desc    Update a category (ADMIN ONLY)
router.put('/categories/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, slug } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ message: 'Category name and slug are required.' });
  }

  try {
    const updatedCategory = await db.query(
      `UPDATE categories SET name = $1, slug = $2 WHERE id = $3 RETURNING *`,
      [String(name).trim(), String(slug).trim().toLowerCase(), id]
    );

    if (updatedCategory.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(updatedCategory.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error updating category');
  }
});

// @route   DELETE /api/products/categories/:id
// @desc    Delete a category (ADMIN ONLY)
router.delete('/categories/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const deletedCategory = await db.query(
      `DELETE FROM categories WHERE id = $1 RETURNING *`,
      [id]
    );

    if (deletedCategory.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error(err.message);
    // If it fails due to foreign key constraints (products existing in this category)
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Cannot delete category because it contains products.' });
    }
    res.status(500).send('Server error deleting category');
  }
});

// @route   GET /api/products/category/:slug
// @desc    Get all products for a specific category using its slug (PUBLIC)
router.get('/category/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const queryText = `
      SELECT p.*, c.name as category_name, c.slug as category_slug, pi.image_url as primary_image
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
      WHERE c.slug = $1
      ORDER BY p.created_at DESC
    `;
    
    const productsRes = await db.query(queryText, [slug.toLowerCase()]);
    
    // We send back the products, plus the name of the category for the page title
    res.json({
      categoryName: productsRes.rows.length > 0 ? productsRes.rows[0].category_name : 'Category',
      products: productsRes.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching category products');
  }
});

// ==========================================
// 📦 PRODUCT ENDPOINTS
// ==========================================

// @route   POST /api/products
// @desc    Upload a new product with multiple images via Cloudinary (ADMIN ONLY)
router.post('/', verifyToken, verifyAdmin, uploadLimiter, upload.array('productImages', 10), async (req, res) => {
  const { name, description, price, stock, is_digital } = req.body;
  const category_id = req.body.category_id || null;
  const vendor_id = req.body.vendor_id || null;
  const isDigitalBool = is_digital === 'true' || is_digital === true;
  const parsedPrice = parsePositiveNumber(price);
  const parsedStock = parsePositiveNumber(stock);

  if (!name || !description || parsedPrice === null || parsedStock === null) {
    return res.status(400).json({ message: 'Name, description, price, and stock are required.' });
  }

  try {
    const productResult = await db.query(
      `INSERT INTO products (category_id, vendor_id, name, description, price, stock, is_digital) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [category_id, vendor_id, String(name).trim(), String(description).trim(), parsedPrice, parsedStock, isDigitalBool]
    );
    
    const newProduct = productResult.rows[0];

    // 2. Handle Cloudinary image insertions if files were uploaded
    if (req.files && req.files.length > 0) {
      const imageQueries = req.files.map((file, index) => {
        // Set the first uploaded image as the primary display image
        const isPrimary = index === 0; 
        return db.query(
          'INSERT INTO product_images (product_id, image_url, is_primary) VALUES ($1, $2, $3)',
          [newProduct.id, file.path, isPrimary] // file.path contains the secure Cloudinary URL
        );
      });
      
      await Promise.all(imageQueries);
    }

    res.status(201).json({
      message: 'Product successfully uploaded',
      product: newProduct
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error during product upload');
  }
});

// @route   GET /api/products
// @desc    Get all products with their primary images (PUBLIC - Showcase storefront)
router.get('/', async (req, res) => {
  try {
    const queryText = `
      SELECT p.*, c.name as category_name, pi.image_url as primary_image
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
      ORDER BY p.created_at DESC
    `;
    const products = await db.query(queryText);
    res.json(products.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching products');
  }
});

// @route   PUT /api/products/:id
// @desc    Update a product's details and append new images (ADMIN ONLY)
router.put('/:id', verifyToken, verifyAdmin, uploadLimiter, upload.array('productImages', 10), async (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock, is_digital } = req.body;
  const category_id = req.body.category_id || null;
  const vendor_id = req.body.vendor_id || null;
  const isDigitalBool = is_digital === 'true' || is_digital === true;
  const parsedPrice = parsePositiveNumber(price);
  const parsedStock = parsePositiveNumber(stock);

  if (!name || !description || parsedPrice === null || parsedStock === null) {
    return res.status(400).json({ message: 'Name, description, price, and stock are required.' });
  }

  try {
    const updatedProduct = await db.query(
      `UPDATE products 
       SET name = $1, description = $2, price = $3, stock = $4, category_id = $5, vendor_id = $6, is_digital = $7
       WHERE id = $8 RETURNING *`,
      [String(name).trim(), String(description).trim(), parsedPrice, parsedStock, category_id, vendor_id, isDigitalBool, id]
    );

    if (updatedProduct.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // 2. Process NEW images added to the gallery
    if (req.files && req.files.length > 0) {
      const primaryCheck = await db.query(
        'SELECT id FROM product_images WHERE product_id = $1 AND is_primary = true',
        [id]
      );
      const hasPrimary = primaryCheck.rows.length > 0;

      const imageQueries = req.files.map((file, index) => {
        const isPrimary = !hasPrimary && index === 0; 
        return db.query(
          `INSERT INTO product_images (product_id, image_url, is_primary) 
           VALUES ($1, $2, $3)`,
          [id, file.path, isPrimary]
        );
      });

      await Promise.all(imageQueries);
    }

    res.json(updatedProduct.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error updating product');
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete a product (ADMIN ONLY)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(`DELETE FROM products WHERE id = $1`, [id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error deleting product');
  }
});

// @route   GET /api/products/:id
// @desc    Get a single product with all its images and vendor details (PUBLIC)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const queryText = `
      SELECT 
        p.*, 
        c.name as category_name, 
        v.name as vendor_name,
        COALESCE(
          json_agg(
            json_build_object('id', pi.id, 'url', pi.image_url, 'is_primary', pi.is_primary)
          ) FILTER (WHERE pi.id IS NOT NULL), '[]'
        ) as images
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id, c.name, v.name
    `;

    const productRes = await db.query(queryText, [id]);

    if (productRes.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(productRes.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error fetching product details');
  }
});

// ==========================================
// 🖼️ IMAGE DELETION ENDPOINT
// ==========================================

// @route   DELETE /api/products/images/:image_id
// @desc    Delete a specific image from a product's gallery (ADMIN ONLY)
router.delete('/images/:image_id', verifyToken, verifyAdmin, async (req, res) => {
  const { image_id } = req.params;

  try {
    const deleteRes = await db.query(
      'DELETE FROM product_images WHERE id = $1 RETURNING *',
      [image_id]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.json({ message: 'Image successfully removed from gallery' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error removing image');
  }
});

module.exports = router;