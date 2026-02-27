const clientService = require('../services/clientService');
const logger = require('../utils/logger');

class ClientController {
  // 注册客户端
  async register(req, res) {
    try {
      const { clientId, machineId, version, os, licenseKey } = req.body;

      if (!clientId || !machineId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'clientId and machineId are required'
          }
        });
      }

      const client = await clientService.registerClient({
        clientId,
        machineId,
        version,
        os,
        licenseKey
      });

      // 获取客户端配置
      let config = await clientService.getClientConfig(clientId);
      if (!config) {
        // 创建默认配置
        config = {
          syncInterval: 30000,
          features: ['ai', 'publish', 'schedule']
        };
        await clientService.updateClientConfig(clientId, config);
      }

      res.json({
        success: true,
        data: {
          clientId: client.client_id,
          config
        }
      });
    } catch (error) {
      logger.error('Register client error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 心跳
  async heartbeat(req, res) {
    try {
      const { clientId, status, metrics } = req.body;

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'clientId is required'
          }
        });
      }

      await clientService.updateHeartbeat(clientId, status || 'online', metrics || {});

      res.json({
        success: true,
        data: {
          serverTime: Date.now(),
          commands: []
        }
      });
    } catch (error) {
      logger.error('Heartbeat error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 获取客户端列表
  async list(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status || 'all';

      const result = await clientService.getClients(page, limit, status);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('List clients error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 获取客户端详情
  async getById(req, res) {
    try {
      const { clientId } = req.params;

      const client = await clientService.getClientById(clientId);

      if (!client) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CLIENT_NOT_FOUND',
            message: 'Client not found'
          }
        });
      }

      res.json({
        success: true,
        data: client
      });
    } catch (error) {
      logger.error('Get client error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 删除客户端
  async delete(req, res) {
    try {
      const { clientId } = req.params;

      await clientService.deleteClient(clientId);

      res.json({
        success: true,
        data: { message: 'Client deleted successfully' }
      });
    } catch (error) {
      logger.error('Delete client error:', error);
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

module.exports = new ClientController();
