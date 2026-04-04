const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'library-secret-key-change-in-production';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' }
    });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
    });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize, JWT_SECRET };
