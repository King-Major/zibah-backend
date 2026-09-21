const rateLimit = require('express-rate-limit');

const createLimiter = (options = {}) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  ...options,
});

const generalLimiter = createLimiter();
const authLimiter = createLimiter({
  limit: 10,
  skipSuccessfulRequests: true,
  message: { message: 'Too many authentication attempts, please try again later.' },
});
const uploadLimiter = createLimiter({
  limit: 20,
  message: { message: 'Too many uploads, please try again later.' },
});
const feedbackLimiter = createLimiter({
  limit: 10,
  windowMs: 60 * 60 * 1000,
  message: { message: 'Too many feedback submissions, please try again later.' },
});

module.exports = { generalLimiter, authLimiter, uploadLimiter, feedbackLimiter };
