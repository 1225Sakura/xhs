import bcrypt from 'bcrypt';
import { generateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import db from '../models/database.js';

class UserController {
  // 用户注册
  async register(req, res) {
    try {
      const { username, password, email, role = 'user' } = req.body;

      // 验证必填字段
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      // 检查用户是否已存在
      const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Username already exists'
        });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      const result = db.prepare(`
        INSERT INTO users (username, password, email, role, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(username, hashedPassword, email || null, role);

      logger.info(`User registered: ${username}`);

      res.json({
        success: true,
        data: {
          id: result.lastInsertRowid,
          username,
          email,
          role
        }
      });
    } catch (error) {
      logger.error('User registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }
  }

  // 用户登录
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // 验证必填字段
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      // 查找用户
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password'
        });
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password'
        });
      }

      // 生成token
      const token = generateToken({
        id: user.id,
        username: user.username,
        role: user.role
      });

      // 更新最后登录时间
      db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);

      logger.info(`User logged in: ${username}`);

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        }
      });
    } catch (error) {
      logger.error('User login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  }

  // 获取当前用户信息
  getCurrentUser(req, res) {
    try {
      const user = db.prepare('SELECT id, username, email, role, created_at, last_login FROM users WHERE id = ?')
        .get(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
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
        error: 'Failed to get user information'
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
          error: 'Old password and new password are required'
        });
      }

      // 获取用户
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // 验证旧密码
      const isValidPassword = await bcrypt.compare(oldPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid old password'
        });
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 更新密码
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

      logger.info(`Password changed for user: ${user.username}`);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }

  // 获取所有用户（管理员）
  list(req, res) {
    try {
      const users = db.prepare('SELECT id, username, email, role, created_at, last_login FROM users ORDER BY created_at DESC').all();

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error('List users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list users'
      });
    }
  }

  // 更新用户（管理员）
  update(req, res) {
    try {
      const { userId } = req.params;
      const { email, role } = req.body;

      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      db.prepare('UPDATE users SET email = ?, role = ? WHERE id = ?').run(email, role, userId);

      logger.info(`User updated: ${userId}`);

      res.json({
        success: true,
        message: 'User updated successfully'
      });
    } catch (error) {
      logger.error('Update user error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user'
      });
    }
  }

  // 删除用户（管理员）
  delete(req, res) {
    try {
      const { userId } = req.params;

      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(userId);

      logger.info(`User deleted: ${userId}`);

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      logger.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete user'
      });
    }
  }

  // 获取审计日志（管理员）
  getAuditLogs(req, res) {
    try {
      // 简化实现：返回空数组
      // 完整实现需要创建audit_logs表
      res.json({
        success: true,
        data: []
      });
    } catch (error) {
      logger.error('Get audit logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get audit logs'
      });
    }
  }
}

export default new UserController();
