const licenseService = require('../services/licenseService');
const logger = require('../utils/logger');

class LicenseController {
  // 创建许可证
  async create(req, res) {
    try {
      const {
        customerName,
        customerEmail,
        planType,
        maxClients,
        features,
        expiresAt
      } = req.body;

      if (!customerName || !customerEmail) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'customerName and customerEmail are required'
          }
        });
      }

      const license = await licenseService.createLicense({
        customerName,
        customerEmail,
        planType,
        maxClients,
        features,
        expiresAt
      });

      res.json({
        success: true,
        data: license
      });
    } catch (error) {
      logger.error('Create license error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 验证许可证
  async verify(req, res) {
    try {
      const { licenseKey, machineId } = req.body;

      if (!licenseKey || !machineId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'licenseKey and machineId are required'
          }
        });
      }

      const result = await licenseService.verifyLicense(licenseKey, machineId);

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: result.reason,
            message: this.getErrorMessage(result.reason),
            details: result
          }
        });
      }

      res.json({
        success: true,
        data: result.license
      });
    } catch (error) {
      logger.error('Verify license error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 获取许可证信息
  async get(req, res) {
    try {
      const { licenseKey } = req.params;

      const license = await licenseService.getLicense(licenseKey);

      if (!license) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'LICENSE_NOT_FOUND',
            message: 'License not found'
          }
        });
      }

      res.json({
        success: true,
        data: license
      });
    } catch (error) {
      logger.error('Get license error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 更新许可证
  async update(req, res) {
    try {
      const { licenseKey } = req.params;
      const updates = req.body;

      const license = await licenseService.updateLicense(licenseKey, updates);

      if (!license) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'LICENSE_NOT_FOUND',
            message: 'License not found or no updates provided'
          }
        });
      }

      res.json({
        success: true,
        data: license
      });
    } catch (error) {
      logger.error('Update license error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 获取公钥
  async getPublicKey(req, res) {
    try {
      const publicKey = licenseService.getPublicKey();

      res.json({
        success: true,
        data: {
          publicKey
        }
      });
    } catch (error) {
      logger.error('Get public key error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 获取错误消息
  getErrorMessage(reason) {
    const messages = {
      LICENSE_NOT_FOUND: 'License key not found',
      LICENSE_INACTIVE: 'License is inactive',
      LICENSE_EXPIRED: 'License has expired',
      MAX_CLIENTS_REACHED: 'Maximum number of clients reached for this license'
    };

    return messages[reason] || 'License verification failed';
  }
}

module.exports = new LicenseController();
