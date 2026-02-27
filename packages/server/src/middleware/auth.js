const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 生成JWT token
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

// 验证JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    logger.error('Token verification failed:', error);
    return null;
  }
}

// JWT认证中间件
function authenticate(req, res, next) {
  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authorization header is required'
        }
      });
    }

    // 解析Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Authorization header format must be: Bearer <token>'
        }
      });
    }

    const token = parts[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }

    // 将解码后的信息附加到请求对象
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed'
      }
    });
  }
}

// 可选认证中间件（token可选）
function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const decoded = verifyToken(token);
        if (decoded) {
          req.user = decoded;
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    next();
  }
}

// 角色检查中间件
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions'
        }
      });
    }

    next();
  };
}

// 客户端认证中间件（用于客户端API）
function authenticateClient(req, res, next) {
  try {
    const clientId = req.body.clientId || req.params.clientId || req.query.clientId;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CLIENT_ID_REQUIRED',
          message: 'Client ID is required'
        }
      });
    }

    // 如果有token，验证token
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const decoded = verifyToken(token);

        if (!decoded) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid or expired token'
            }
          });
        }

        // 验证token中的clientId与请求中的clientId是否匹配
        if (decoded.clientId !== clientId) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'CLIENT_ID_MISMATCH',
              message: 'Client ID does not match token'
            }
          });
        }

        req.client = decoded;
      }
    }

    req.clientId = clientId;
    next();
  } catch (error) {
    logger.error('Client authentication error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed'
      }
    });
  }
}

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  optionalAuthenticate,
  requireRole,
  authenticateClient
};
