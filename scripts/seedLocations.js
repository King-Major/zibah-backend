// Usage: npm run seed:locations
// Upserts the default pickup locations by name (safe to re-run, never deletes anything).
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../db');
const PickupLocation = require('../models/PickupLocation');

const LOCATIONS = [
  { name: 'Within UNILAG', address: 'University of Lagos Campus Area', addedFee: 300 },
  { name: 'Within YABATECH', address: 'Yaba College of Technology Campus Area', addedFee: 300 },
  { name: 'Abule Oja', address: 'Abule Oja and Environs', addedFee: 600 },
  { name: 'Chemist & Pako', address: 'Chemist / Pako Bus Stop Area', addedFee: 1000 },
  { name: 'Bariga', address: 'Bariga and Environs', addedFee: 1200 },
  { name: 'Shomolu', address: 'Shomolu and Environs', addedFee: 1500 },
];

(async () => {
  try {
    await connectDB();
    for (const loc of LOCATIONS) {
      await PickupLocation.updateOne({ name: loc.name }, { $set: loc }, { upsert: true });
    }
    console.log(`✅ ${LOCATIONS.length} pickup locations seeded`);
  } catch (err) {
    console.error('❌', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
