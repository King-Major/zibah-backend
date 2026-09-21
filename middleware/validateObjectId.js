const { isId } = require('../utils/helpers');

// Usage: router.get('/:id', validateObjectId('id'), handler)
// Returns 400 instead of letting Mongoose throw a CastError.
const validateObjectId = (...params) => (req, res, next) => {
  for (const param of params) {
    if (!isId(req.params[param])) {
      return res.status(400).json({ message: `Invalid ${param}.` });
    }
  }
  next();
};

module.exports = validateObjectId;
