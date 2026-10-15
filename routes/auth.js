const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const sendBrandEmail = require('../utils/email');
const { authLimiter } = require('../middleware/security');
const { serializeUser } = require('../utils/serializers');
const { isValidEmail, isValidPassword, cleanString } = require('../utils/helpers');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const newVerificationToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: sha256(token), expires: new Date(Date.now() + TOKEN_TTL_MS) };
};

const sendVerificationEmail = async (req, email, token) => {
  const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  const verificationUrl = `${backendUrl}/api/auth/verify/${token}`;
  const emailHtml = `
    <h2 style="font-family: 'Montserrat', sans-serif; color: #002366;">Welcome to ZIBAH STORES!</h2>
    <p>We are thrilled to have you. Before you can start shopping, please verify your email address by clicking the button below:</p>
    <a href="${verificationUrl}" style="display: inline-block; margin-top: 15px; padding: 12px 25px; background-color: #FACF53; color: #002366; text-decoration: none; font-weight: bold; border-radius: 5px;">Verify My Email</a>
    <p style="margin-top: 20px; font-size: 14px; color: #666;">This link expires in 24 hours. If you did not create this account, please ignore this email.</p>
  `;
  await sendBrandEmail(email, 'Verify your ZIBAH STORES Account', emailHtml);
};

const resultPage = (title, message, { ok }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `
    <div style="text-align: center; font-family: sans-serif; padding: 50px;">
      <h1 style="color: ${ok ? '#002366' : '#b00020'};">${title}</h1>
      <p>${message}</p>
      <a href="${frontendUrl}" style="display: inline-block; margin-top: 20px; padding: 12px 25px; background-color: #FACF53; color: #002366; text-decoration: none; font-weight: bold; border-radius: 5px;">Go to Store</a>
    </div>`;
};

// @route   POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const name = cleanString(req.body.name);
  const whatsappNumber = cleanString(req.body.whatsappNumber);
  const email = cleanString(req.body.email).toLowerCase();
  const { password } = req.body;

  if (!name || name.length > 100) {
    return res.status(400).json({ message: 'Please provide your name (up to 100 characters).' });
  }

  const phoneDigits = whatsappNumber.replace(/\D/g, '');
  if (
    whatsappNumber.length > 20 ||
    !/^\+?[\d\s().-]+$/.test(whatsappNumber) ||
    phoneDigits.length < 7 ||
    phoneDigits.length > 15
  ) {
    return res.status(400).json({ message: 'Please provide a valid WhatsApp number, including its country code.' });
  }

  if (!isValidEmail(email) || !isValidPassword(password)) {
    return res.status(400).json({ message: 'Please provide a valid email and a password with at least 8 characters and no spaces.' });
  }

  if (await User.exists({ email })) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { token, hash, expires } = newVerificationToken();

  let user;
  try {
    user = await User.create({
      name, whatsappNumber, email, passwordHash, role: 'CUSTOMER',
      verificationTokenHash: hash, verificationExpires: expires,
    });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'User already exists' });
    throw err;
  }

  try {
    await sendVerificationEmail(req, email, token);
  } catch (err) {
    // No transactions needed: just undo the signup so the person can retry
    await User.deleteOne({ _id: user._id });
    console.error('Verification email failed, signup rolled back:', err.message);
    return res.status(500).json({ message: 'We could not send the verification email. Please try again.' });
  }

  res.status(201).json({
    message: 'Registration successful! Please check your email to verify your account before logging in.',
  });
});

// @route   GET /api/auth/verify/:token
router.get('/verify/:token', async (req, res) => {
  const hash = sha256(String(req.params.token));

  const user = await User.findOneAndUpdate(
    { verificationTokenHash: hash, verificationExpires: { $gt: new Date() } },
    { $set: { isVerified: true }, $unset: { verificationTokenHash: 1, verificationExpires: 1 } }
  );

  if (!user) {
    return res.status(400).send(resultPage('Verification failed', 'This verification link is invalid or has expired.', { ok: false }));
  }
  res.send(resultPage('Email Verified Successfully!', 'You can now log in to ZIBAH STORES.', { ok: true }));
});

// @route   POST /api/auth/resend-verification
router.post('/resend-verification', authLimiter, async (req, res) => {
  const email = cleanString(req.body.email).toLowerCase();
  const generic = { message: 'If that account exists and is unverified, a new verification email has been sent.' };

  if (!isValidEmail(email)) return res.status(400).json({ message: 'Please provide a valid email.' });

  const user = await User.findOne({ email });
  if (user && !user.isVerified) {
    const { token, hash, expires } = newVerificationToken();
    user.verificationTokenHash = hash;
    user.verificationExpires = expires;
    await user.save();
    try {
      await sendVerificationEmail(req, email, token);
    } catch (err) {
      console.error('Resend verification failed:', err.message);
    }
  }
  res.json(generic);
});

// @route   POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const email = cleanString(req.body.email).toLowerCase();
  const { password } = req.body;

  if (!isValidEmail(email) || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Please provide a valid email and password.' });
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) return res.status(400).json({ message: 'Invalid Credentials' });

  if (!user.isVerified) {
    return res.status(403).json({ message: 'Please verify your email address before logging in.' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return res.status(400).json({ message: 'Invalid Credentials' });

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '24h',
    algorithm: 'HS256',
  });

  res.json({ token, user: serializeUser(user), message: 'Login successful' });
});

module.exports = router;
