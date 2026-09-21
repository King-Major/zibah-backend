// Usage: set ADMIN_EMAIL and ADMIN_PASSWORD in .env, then run `npm run seed:admin`
// Creates (or resets the password of) a verified SUPER_ADMIN account.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../db');
const User = require('../models/User');
const { isValidEmail, isValidPassword } = require('../utils/helpers');

(async () => {
  try {
    const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!isValidEmail(email) || !isValidPassword(password)) {
      throw new Error('Set a valid ADMIN_EMAIL and an ADMIN_PASSWORD (8+ chars, no spaces) in your .env');
    }

    await connectDB();
    const passwordHash = await bcrypt.hash(password, 12);

    await User.findOneAndUpdate(
      { email },
      {
        $set: { passwordHash, role: 'SUPER_ADMIN', isVerified: true },
        $unset: { verificationTokenHash: 1, verificationExpires: 1 },
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Admin ready: ${email}`);
  } catch (err) {
    console.error('❌', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
