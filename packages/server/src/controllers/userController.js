const userService = require('../services/userService');
const logger = require('../utils/logger');

class UserController {
  // 用户注册
  async register(req, res) {
    try {
      const { username, email, password, role } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'username, email, and password are required'
          }
        });
      }

      // 验证密码强度
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Password must be at least 8 characters long'
          }
        });
      }

      const user = await userService.createUser({
        username,
        email,
        password,
        role
      });

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Register error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 用户登录
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'username and password are required'
          }
        });
      }

      const result = await userService.login(username, password);

      if (!result.success) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: result.error
          }
        });
      }

      // 记录IP地址
      const ipAddress = req.ip || req.connection.remoteAddress;
      await userService.logAudit(result.user.id, 'USER_LOGIN', { username }, ipAddress);

      res.json({
        success: true,
        data: {
          user: result.user,
          token: result.token
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 获取当前用户信息
  async getCurrentUser(req, res) {
    try {
      const user = await userService.getUser(req.user.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 修改密码
  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'oldPassword and newPassword are required'
          }
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Password must be at least 8 characters long'
          }
        });
      }

      await userService.changePassword(req.user.userId, oldPassword, newPassword);

      res.json({
        success: true,
        data: { message: 'Password changed successfully' }
      });
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 获取用户列表（管理员）
  async list(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await userService.getUsers(page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('List users error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 更新用户（管理员）
  async update(req, res) {
    try {
      const { userId } = req.params;
      const updates = req.body;

      const user = await userService.updateUser(parseInt(userId), updates);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found or no updates provided'
          }
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Update user error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 删除用户（管理员）
  async delete(req, res) {
    try {
      const { userId } = req.params;

      await userService.deleteUser(parseInt(userId));

      res.json({
        success: true,
        data: { message: 'User deleted successfully' }
      });
    } catch (error) {
      logger.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 获取审计日志
  async getAuditLogs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const filters = {
        userId: req.query.userId ? parseInt(req.query.userId) : null,
        action: req.query.action,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const result = await userService.getAuditLogs(filters, page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get audit logs error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }
}

module.exports = new UserController();
