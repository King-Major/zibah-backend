const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['CUSTOMER', 'SUPER_ADMIN'], default: 'CUSTOMER' },
    isVerified: { type: Boolean, default: false },
    // Only a SHA-256 hash of the emailed token is stored
    verificationTokenHash: { type: String, select: false, index: true },
    verificationExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
