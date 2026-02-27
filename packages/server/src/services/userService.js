const bcrypt = require('bcrypt');
const db = require('../models/cloudDatabase');
const { generateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const SALT_ROUNDS = 10;

class UserService {
  // 创建用户
  async createUser(userData) {
    const { username, email, password, role = 'user' } = userData;

    try {
      // 检查用户名是否已存在
      const existingUser = await db.query(
        'SELECT * FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Username or email already exists');
      }

      // 加密密码
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // 创建用户
      const result = await db.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, role, created_at`,
        [username, email, passwordHash, role]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  // 用户登录
  async login(username, password) {
    try {
      // 查找用户
      const result = await db.query(
        'SELECT * FROM users WHERE username = $1 OR email = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      const user = result.rows[0];

      // 验证密码
      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      // 生成token
      const token = generateToken({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      });

      // 记录审计日志
      await this.logAudit(user.id, 'USER_LOGIN', { username: user.username });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token
      };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  // 修改密码
  async changePassword(userId, oldPassword, newPassword) {
    try {
      // 获取用户
      const result = await db.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      // 验证旧密码
      const isValid = await bcrypt.compare(oldPassword, user.password_hash);

      if (!isValid) {
        throw new Error('Invalid old password');
      }

      // 加密新密码
      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // 更新密码
      await db.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [newPasswordHash, userId]
      );

      // 记录审计日志
      await this.logAudit(userId, 'PASSWORD_CHANGED', {});

      return { success: true };
    } catch (error) {
      logger.error('Failed to change password:', error);
      throw error;
    }
  }

  // 获取用户信息
  async getUser(userId) {
    try {
      const result = await db.query(
        'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get user:', error);
      throw error;
    }
  }

  // 获取用户列表
  async getUsers(page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;

      const result = await db.query(
        `SELECT id, username, email, role, created_at
         FROM users
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const countResult = await db.query('SELECT COUNT(*) FROM users');

      return {
        users: result.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        limit
      };
    } catch (error) {
      logger.error('Failed to get users:', error);
      throw error;
    }
  }

  // 更新用户
  async updateUser(userId, updates) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.email) {
        fields.push(`email = $${paramIndex}`);
        values.push(updates.email);
        paramIndex++;
      }

      if (updates.role) {
        fields.push(`role = $${paramIndex}`);
        values.push(updates.role);
        paramIndex++;
      }

      if (fields.length === 0) {
        return null;
      }

      values.push(userId);

      const result = await db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, username, email, role, created_at`,
        values
      );

      // 记录审计日志
      await this.logAudit(userId, 'USER_UPDATED', updates);

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update user:', error);
      throw error;
    }
  }

  // 删除用户
  async deleteUser(userId) {
    try {
      await db.query('DELETE FROM users WHERE id = $1', [userId]);

      // 记录审计日志
      await this.logAudit(null, 'USER_DELETED', { userId });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete user:', error);
      throw error;
    }
  }

  // 记录审计日志
  async logAudit(userId, action, details, ipAddress = null) {
    try {
      await db.query(
        `INSERT INTO audit_logs (user_id, action, details, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [userId, action, JSON.stringify(details), ipAddress]
      );
    } catch (error) {
      logger.error('Failed to log audit:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  // 获取审计日志
  async getAuditLogs(filters = {}, page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;
      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (filters.userId) {
        conditions.push(`user_id = $${paramIndex}`);
        values.push(filters.userId);
        paramIndex++;
      }

      if (filters.action) {
        conditions.push(`action = $${paramIndex}`);
        values.push(filters.action);
        paramIndex++;
      }

      if (filters.startDate) {
        conditions.push(`created_at >= $${paramIndex}`);
        values.push(filters.startDate);
        paramIndex++;
      }

      if (filters.endDate) {
        conditions.push(`created_at <= $${paramIndex}`);
        values.push(filters.endDate);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      values.push(limit, offset);

      const result = await db.query(
        `SELECT * FROM audit_logs ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        values
      );

      const countResult = await db.query(
        `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
        values.slice(0, -2)
      );

      return {
        logs: result.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        limit
      };
    } catch (error) {
      logger.error('Failed to get audit logs:', error);
      throw error;
    }
  }
}

module.exports = new UserService();
