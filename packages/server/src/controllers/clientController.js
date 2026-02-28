import { generateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import db from '../models/database.js';
import crypto from 'crypto';

class ClientController {
  // 注册客户端
  register(req, res) {
    try {
      const { clientId, hostname, platform, version } = req.body;

      if (!clientId || !hostname) {
        return res.status(400).json({
          success: false,
          error: 'Client ID and hostname are required'
        });
      }

      // 检查客户端是否已存在
      const existing = db.prepare('SELECT id FROM clients WHERE client_id = ?').get(clientId);

      if (existing) {
        // 更新现有客户端
        db.prepare(`
          UPDATE clients
          SET hostname = ?, platform = ?, version = ?, last_seen = datetime('now'), status = 'online'
          WHERE client_id = ?
        `).run(hostname, platform || null, version || null, clientId);

        logger.info(`Client updated: ${clientId}`);
      } else {
        // 创建新客户端
        db.prepare(`
          INSERT INTO clients (client_id, hostname, platform, version, status, registered_at, last_seen)
          VALUES (?, ?, ?, ?, 'online', datetime('now'), datetime('now'))
        `).run(clientId, hostname, platform || null, version || null);

        logger.info(`Client registered: ${clientId}`);
      }

      // 生成客户端token
      const token = generateToken({
        clientId,
        type: 'client'
      });

      res.json({
        success: true,
        data: {
          clientId,
          token,
          message: existing ? 'Client updated' : 'Client registered'
        }
      });
    } catch (error) {
      logger.error('Client registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }
  }

  // 客户端心跳
  heartbeat(req, res) {
    try {
      const { clientId } = req;
      const { status = 'online', metrics } = req.body;

      // 更新客户端状态
      db.prepare(`
        UPDATE clients
        SET status = ?, last_seen = datetime('now')
        WHERE client_id = ?
      `).run(status, clientId);

      // 如果有指标数据，保存到metrics表
      if (metrics) {
        db.prepare(`
          INSERT INTO client_metrics (client_id, cpu_usage, memory_usage, disk_usage, timestamp)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).run(
          clientId,
          metrics.cpu || null,
          metrics.memory || null,
          metrics.disk || null
        );
      }

      res.json({
        success: true,
        message: 'Heartbeat received'
      });
    } catch (error) {
      logger.error('Heartbeat error:', error);
      res.status(500).json({
        success: false,
        error: 'Heartbeat failed'
      });
    }
  }

  // 获取所有客户端（管理员）
  list(req, res) {
    try {
      const clients = db.prepare(`
        SELECT client_id, hostname, platform, version, status, registered_at, last_seen
        FROM clients
        ORDER BY last_seen DESC
      `).all();

      res.json({
        success: true,
        data: clients
      });
    } catch (error) {
      logger.error('List clients error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list clients'
      });
    }
  }

  // 获取客户端详情（管理员）
  getById(req, res) {
    try {
      const { clientId } = req.params;

      const client = db.prepare(`
        SELECT client_id, hostname, platform, version, status, registered_at, last_seen
        FROM clients
        WHERE client_id = ?
      `).get(clientId);

      if (!client) {
        return res.status(404).json({
          success: false,
          error: 'Client not found'
        });
      }

      // 获取最近的指标数据
      const metrics = db.prepare(`
        SELECT cpu_usage, memory_usage, disk_usage, timestamp
        FROM client_metrics
        WHERE client_id = ?
        ORDER BY timestamp DESC
        LIMIT 10
      `).all(clientId);

      res.json({
        success: true,
        data: {
          ...client,
          metrics
        }
      });
    } catch (error) {
      logger.error('Get client error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get client'
      });
    }
  }

  // 删除客户端（管理员）
  delete(req, res) {
    try {
      const { clientId } = req.params;

      const client = db.prepare('SELECT id FROM clients WHERE client_id = ?').get(clientId);
      if (!client) {
        return res.status(404).json({
          success: false,
          error: 'Client not found'
        });
      }

      // 删除客户端及其相关数据
      db.prepare('DELETE FROM clients WHERE client_id = ?').run(clientId);
      db.prepare('DELETE FROM client_metrics WHERE client_id = ?').run(clientId);

      logger.info(`Client deleted: ${clientId}`);

      res.json({
        success: true,
        message: 'Client deleted successfully'
      });
    } catch (error) {
      logger.error('Delete client error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete client'
      });
    }
  }
}

export default new ClientController();
