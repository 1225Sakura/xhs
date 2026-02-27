const metricsService = require('../services/metricsService');
const logger = require('../utils/logger');

class MetricsController {
  // 导出Prometheus指标
  async exportMetrics(req, res) {
    try {
      res.set('Content-Type', metricsService.getContentType());
      const metrics = await metricsService.getMetrics();
      res.send(metrics);
    } catch (error) {
      logger.error('Export metrics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 获取指标摘要（JSON格式）
  async getMetricsSummary(req, res) {
    try {
      const metrics = await metricsService.register.getMetricsAsJSON();
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Get metrics summary error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }

  // 重置指标（仅用于测试）
  async resetMetrics(req, res) {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot reset metrics in production'
          }
        });
      }

      metricsService.resetMetrics();
      res.json({
        success: true,
        data: { message: 'Metrics reset successfully' }
      });
    } catch (error) {
      logger.error('Reset metrics error:', error);
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

module.exports = new MetricsController();
