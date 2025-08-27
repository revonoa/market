const jwt = require('jsonwebtoken');

function signAccess(user) {
  return jwt.sign(
    { id: user.id, role: user.role, nickname: user.nickname },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
}

module.exports = { signAccess };
