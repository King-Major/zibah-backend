const jwt = require('jsonwebtoken');

const extractToken = (req) => {
  const authHeader = req.header('Authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
};

const decode = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  return decoded && typeof decoded === 'object' ? decoded : null;
};

const verifyToken = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'No token provided, authorization denied' });
  }

  try {
    const decoded = decode(token);
    if (!decoded) return res.status(401).json({ message: 'Token is not valid' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Attaches req.user if a valid token is present, but never blocks the request
const optionalAuth = (req, res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = decode(token);
      if (decoded) req.user = decoded;
    } catch (err) {
      /* ignore invalid token */
    }
  }
  next();
};

const verifyAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
  }
  next();
};

module.exports = { verifyToken, verifyAdmin, optionalAuth };
