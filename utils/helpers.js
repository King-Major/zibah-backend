const mongoose = require('mongoose');

const isId = (value) => typeof value === 'string' && mongoose.isObjectIdOrHexString(value);

const isValidEmail = (v) => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isValidPassword = (v) => typeof v === 'string' && v.length >= 8 && v.length <= 72 && !/\s/.test(v);

// Only accepts real numbers / numeric strings (rejects '', null, true, objects)
const toNumber = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const parsePositiveNumber = (v) => { const n = toNumber(v); return n !== null && n > 0 ? n : null; };
const parseNonNegativeNumber = (v) => { const n = toNumber(v); return n !== null && n >= 0 ? n : null; };
const parseNonNegativeInt = (v) => { const n = toNumber(v); return n !== null && Number.isInteger(n) && n >= 0 ? n : null; };

// Returns '' for anything that is not a string – blocks NoSQL operator objects
const cleanString = (v) => (typeof v === 'string' ? v.trim() : '');

const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = {
  isId, isValidEmail, isValidPassword, parsePositiveNumber, parseNonNegativeNumber,
  parseNonNegativeInt, cleanString, escapeHtml,
};
