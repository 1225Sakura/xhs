const clientService = require('../services/clientService');
const logger = require('../utils/logger');

class ConfigController {
  // 获取配置
  async getConfig(req, res) {
    try {
      const { clientId } = req.params;

      const config = await clientService.getClientConfig(clientId);

      if (!config) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONFIG_NOT_FOUND',
            message: 'Configuration not found'
          }
        });
      }

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Get config error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 更新配置
  async updateConfig(req, res) {
    try {
      const { clientId } = req.params;
      const config = req.body;

      const result = await clientService.updateClientConfig(clientId, config);

      res.json({
        success: true,
        data: result.config
      });
    } catch (error) {
      logger.error('Update config error:', error);
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

module.exports = new ConfigController();
