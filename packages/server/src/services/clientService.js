const db = require('../models/cloudDatabase');
const logger = require('../utils/logger');

class ClientService {
  // 注册客户端
  async registerClient(clientData) {
    const { clientId, machineId, version, os, licenseKey } = clientData;

    try {
      // 检查客户端是否已存在
      const existingClient = await db.query(
        'SELECT * FROM clients WHERE client_id = $1',
        [clientId]
      );

      if (existingClient.rows.length > 0) {
        // 更新现有客户端
        const result = await db.query(
          `UPDATE clients
           SET machine_id = $2, version = $3, os = $4, license_key = $5,
               status = 'online', last_seen = CURRENT_TIMESTAMP
           WHERE client_id = $1
           RETURNING *`,
          [clientId, machineId, version, os, licenseKey]
        );
        return result.rows[0];
      } else {
        // 创建新客户端
        const result = await db.query(
          `INSERT INTO clients (client_id, machine_id, version, os, license_key, status, last_seen)
           VALUES ($1, $2, $3, $4, $5, 'online', CURRENT_TIMESTAMP)
           RETURNING *`,
          [clientId, machineId, version, os, licenseKey]
        );
        return result.rows[0];
      }
    } catch (error) {
      logger.error('Failed to register client:', error);
      throw error;
    }
  }

  // 更新心跳
  async updateHeartbeat(clientId, status, metrics) {
    try {
      // 更新客户端状态
      await db.query(
        `UPDATE clients
         SET status = $2, last_seen = CURRENT_TIMESTAMP
         WHERE client_id = $1`,
        [clientId, status]
      );

      // 记录心跳
      await db.query(
        `INSERT INTO heartbeats (client_id, status, metrics)
         VALUES ($1, $2, $3)`,
        [clientId, status, JSON.stringify(metrics)]
      );

      return { success: true };
    } catch (error) {
      logger.error('Failed to update heartbeat:', error);
      throw error;
    }
  }

  // 获取客户端列表
  async getClients(page = 1, limit = 20, statusFilter = 'all') {
    try {
      const offset = (page - 1) * limit;
      let whereClause = '';
      const params = [limit, offset];

      if (statusFilter !== 'all') {
        whereClause = 'WHERE status = $3';
        params.push(statusFilter);
      }

      const result = await db.query(
        `SELECT * FROM clients ${whereClause}
         ORDER BY last_seen DESC
         LIMIT $1 OFFSET $2`,
        params
      );

      const countResult = await db.query(
        `SELECT COUNT(*) FROM clients ${whereClause}`,
        statusFilter !== 'all' ? [statusFilter] : []
      );

      return {
        clients: result.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        limit
      };
    } catch (error) {
      logger.error('Failed to get clients:', error);
      throw error;
    }
  }

  // 获取客户端详情
  async getClientById(clientId) {
    try {
      const result = await db.query(
        'SELECT * FROM client_status_overview WHERE client_id = $1',
        [clientId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get client:', error);
      throw error;
    }
  }

  // 删除客户端
  async deleteClient(clientId) {
    try {
      await db.query('DELETE FROM clients WHERE client_id = $1', [clientId]);
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete client:', error);
      throw error;
    }
  }

  // 获取客户端配置
  async getClientConfig(clientId) {
    try {
      const result = await db.query(
        'SELECT config FROM client_configs WHERE client_id = $1',
        [clientId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].config;
    } catch (error) {
      logger.error('Failed to get client config:', error);
      throw error;
    }
  }

  // 更新客户端配置
  async updateClientConfig(clientId, config) {
    try {
      const result = await db.query(
        `INSERT INTO client_configs (client_id, config)
         VALUES ($1, $2)
         ON CONFLICT (client_id)
         DO UPDATE SET config = $2, version = client_configs.version + 1
         RETURNING *`,
        [clientId, JSON.stringify(config)]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update client config:', error);
      throw error;
    }
  }
}

module.exports = new ClientService();
