const jwt = require('jsonwebtoken');

module.exports = function attachUser(req, res, next) {
    res.locals.me = null;
    
  const token = req.cookies && req.cookies.access_token;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload;       // { id, role, nickname }
    res.locals.me = payload;  // EJS에서 사용 가능
  } catch (_) { /* empty */ }
  next();
};
