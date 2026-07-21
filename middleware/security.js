const rateLimit = require('express-rate-limit');

const createLimiter = (options = {}) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  ...options,
});

const generalLimiter = createLimiter();
const authLimiter = createLimiter({
  max: 10,
  skipSuccessfulRequests: true,
  message: { message: 'Too many authentication attempts, please try again later.' },
});
const uploadLimiter = createLimiter({
  max: 20,
  message: { message: 'Too many uploads, please try again later.' },
});

module.exports = { generalLimiter, authLimiter, uploadLimiter };
