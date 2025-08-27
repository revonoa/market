const jwt = require('jsonwebtoken');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies && req.cookies.access_token) return req.cookies.access_token; // ✅ 쿠키 허용
  return null;
}

function authRequired(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'Auth required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Auth required' });
    if (req.user.role !== role) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

module.exports = { authRequired, requireRole };
