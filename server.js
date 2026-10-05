require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { connectDB } = require('./db');
const { generalLimiter } = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');

const missing = ['MONGODB_URI', 'JWT_SECRET'].filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
app.use(helmet());

const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];
const allowedOrigins = [...new Set([
  ...defaultOrigins,
  ...(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
])];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({
  limit: '1mb',
  verify: (req, res, buffer) => {
    if (req.originalUrl.startsWith('/api/checkout/webhook')) req.rawBody = buffer;
  },
}));
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});
app.use('/api', generalLimiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/checkout', require('./routes/checkout'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/feedbacks', require('./routes/feedbacks'));
app.use('/api/upload', require('./routes/upload'));

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  const server = app.listen(PORT, () => console.log(`ZIBAH STORES API running on port ${PORT}`));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
