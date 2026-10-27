const mongoose = require('mongoose');
const CartItem = require('./models/CartItem');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  await CartItem.collection.createIndex(
    { user: 1, product: 1, color: 1, size: 1 },
    { unique: true }
  );
  const indexes = await CartItem.collection.indexes();
  const legacyIndex = indexes.find((index) =>
    index.unique && index.key.user === 1 && index.key.product === 1 &&
    Object.keys(index.key).length === 2
  );
  if (legacyIndex) await CartItem.collection.dropIndex(legacyIndex.name);
  console.log(`MongoDB connected (${mongoose.connection.name})`);
};

module.exports = { connectDB };