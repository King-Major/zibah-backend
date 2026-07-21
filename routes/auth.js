const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const sendBrandEmail = require('../utils/email');
const { authLimiter } = require('../middleware/security');

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidPassword = (value) => typeof value === 'string' && value.length >= 8 && !/\s/.test(value);

// @route   POST /api/auth/register
// @desc    Register user & send verification email
router.post('/register', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || !isValidEmail(email) || !isValidPassword(password)) {
    return res.status(400).json({ message: 'Please provide a valid email and a password with at least 8 characters and no spaces.' });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const newUser = await db.query(
      `INSERT INTO users (email, password_hash, role, verification_token) 
       VALUES ($1, $2, $3, $4) RETURNING id, email, role, verification_token`,
      [normalizedEmail, passwordHash, 'CUSTOMER', verificationToken]
    );

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify?token=${verificationToken}`;
    const emailHtml = `
      <h2 style="font-family: 'Montserrat', sans-serif; color: #002366;">Welcome to ZIBAH STORES!</h2>
      <p>We are thrilled to have you. Before you can start shopping, please verify your email address by clicking the button below:</p>
      <a href="${verificationUrl}" style="display: inline-block; margin-top: 15px; padding: 12px 25px; background-color: #FACF53; color: #002366; text-decoration: none; font-weight: bold; border-radius: 5px;">Verify My Email</a>
      <p style="margin-top: 20px; font-size: 14px; color: #666;">If you did not create this account, please ignore this email.</p>
    `;

    await sendBrandEmail(normalizedEmail, 'Verify your ZIBAH STORES Account', emailHtml);

    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account before logging in.'
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @route   GET /api/auth/verify/:token
// @desc    Verify user email via token
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // 1. Find user by token
    const userResult = await db.query('SELECT * FROM users WHERE verification_token = $1', [token]);
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification token.' });
    }

    // 2. Mark user as verified and clear the token
    await db.query(
      `UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE id = $1`,
      [userResult.rows[0].id]
    );

    res.send(`
      <div style="text-align: center; font-family: sans-serif; padding: 50px;">
        <h1 style="color: #002366;">Email Verified Successfully!</h1>
        <p>You can now log in to ZIBAH STORES.</p>
      </div>
    `);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error during verification');
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || !isValidEmail(email)) {
    return res.status(400).json({ message: 'Please provide a valid email and password.' });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    const user = userResult.rows[0];

    if (!user.is_verified) {
      return res.status(403).json({ message: 'Please verify your email address before logging in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
      message: 'Login successful'
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error during authentication' });
  }
});

module.exports = router;