import logger from '../utils/logger.js';
import db from '../models/database.js';

class ConfigController {
  // 获取客户端配置
  getConfig(req, res) {
    try {
      const { clientId } = req.params;

      const configs = db.prepare(`
        SELECT config_key, config_value, updated_at
        FROM client_configs
        WHERE client_id = ?
      `).all(clientId);

      // 转换为键值对对象
      const configObj = {};
      configs.forEach(config => {
        try {
          configObj[config.config_key] = JSON.parse(config.config_value);
        } catch {
          configObj[config.config_key] = config.config_value;
        }
      });

      res.json({
        success: true,
        data: {
          clientId,
          configs: configObj,
          count: configs.length
        }
      });
    } catch (error) {
      logger.error('获取配置失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get config'
      });
    }
  }

  // 更新客户端配置（管理员）
  updateConfig(req, res) {
    try {
      const { clientId } = req.params;
      const { configs } = req.body;

      if (!configs || typeof configs !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Configs object is required'
        });
      }

      // 检查客户端是否存在
      const client = db.prepare('SELECT id FROM clients WHERE client_id = ?').get(clientId);
      if (!client) {
        return res.status(404).json({
          success: false,
          error: 'Client not found'
        });
      }

      // 使用事务更新配置
      const updateStmt = db.prepare(`
        INSERT INTO client_configs (client_id, config_key, config_value, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(client_id, config_key)
        DO UPDATE SET config_value = excluded.config_value, updated_at = datetime('now')
      `);

      const transaction = db.transaction((configs) => {
        for (const [key, value] of Object.entries(configs)) {
          const configValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          updateStmt.run(clientId, key, configValue);
        }
      });

      transaction(configs);

      logger.info(`配置已更新: ${clientId}, ${Object.keys(configs).length} 项`);

      res.json({
        success: true,
        message: 'Config updated successfully',
        count: Object.keys(configs).length
      });
    } catch (error) {
      logger.error('更新配置失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update config'
      });
    }
  }
}

export default new ConfigController();
