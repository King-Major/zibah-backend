const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ message: 'No token provided, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    if (!decoded || typeof decoded !== 'object') {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
  }
  next();
};

module.exports = { verifyToken, verifyAdmin };