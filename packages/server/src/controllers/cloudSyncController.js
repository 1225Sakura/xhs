const syncService = require('../services/syncService');
const logger = require('../utils/logger');

class SyncController {
  // 上传数据
  async upload(req, res) {
    try {
      const { clientId, dataType, data } = req.body;

      if (!clientId || !dataType || !Array.isArray(data)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'clientId, dataType, and data array are required'
          }
        });
      }

      const result = await syncService.uploadData(clientId, dataType, data);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Upload data error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 下载数据
  async download(req, res) {
    try {
      const { clientId } = req.params;
      const { since } = req.query;

      const data = await syncService.downloadData(clientId, since);

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('Download data error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 上报指标
  async uploadMetrics(req, res) {
    try {
      const { clientId, timestamp, metrics } = req.body;

      if (!clientId || !metrics) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'clientId and metrics are required'
          }
        });
      }

      const result = await syncService.uploadMetrics(
        clientId,
        timestamp || Date.now(),
        metrics
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Upload metrics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 获取指标
  async getMetrics(req, res) {
    try {
      const { clientId } = req.params;
      const { metricName, startTime, endTime } = req.query;

      const metrics = await syncService.getMetrics(
        clientId,
        metricName,
        startTime,
        endTime
      );

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Get metrics error:', error);
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

module.exports = new SyncController();
