import publishHistoryService from '../services/publishHistoryService.js';

/**
 * 发布历史控制器
 */
class HistoryController {
  /**
   * 获取发布历史列表
   * GET /api/publish-history
   */
  async getHistory(req, res) {
    try {
      const {
        page = 1,
        pageSize = 20,
        status,
        post_id,
        platform,
        startDate,
        endDate,
        is_retry
      } = req.query;

      const options = {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        status,
        post_id: post_id ? parseInt(post_id) : null,
        platform,
        startDate,
        endDate,
        is_retry: is_retry !== undefined ? is_retry === 'true' : null
      };

      const result = publishHistoryService.getHistory(options);
      res.json(result);
    } catch (error) {
      console.error('❌ 获取发布历史失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取发布统计
   * GET /api/publish-stats
   */
  async getStats(req, res) {
    try {
      const {
        days = 30,
        post_id
      } = req.query;

      const options = {
        days: parseInt(days),
        post_id: post_id ? parseInt(post_id) : null
      };

      const result = publishHistoryService.getStats(options);
      res.json(result);
    } catch (error) {
      console.error('❌ 获取统计数据失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 导出发布历史为CSV
   * GET /api/publish-history/export
   */
  async exportCSV(req, res) {
    try {
      const {
        status,
        startDate,
        endDate,
        limit = 10000
      } = req.query;

      const options = {
        status,
        startDate,
        endDate,
        limit: parseInt(limit)
      };

      console.log('📊 导出发布历史为CSV:', options);

      const result = await publishHistoryService.exportToCSV(options);

      if (!result.success) {
        return res.status(500).json(result);
      }

      // 设置响应头
      const filename = `publish-history-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // 添加UTF-8 BOM以支持Excel正确显示中文
      res.write('\uFEFF');
      res.write(result.data);
      res.end();

      console.log(`✅ 导出成功: ${result.count} 条记录`);
    } catch (error) {
      console.error('❌ 导出CSV失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取每日统计
   * GET /api/publish-stats/daily
   */
  async getDailyStats(req, res) {
    try {
      const { days = 30 } = req.query;
      const result = publishHistoryService.getDailyStats(parseInt(days));
      res.json(result);
    } catch (error) {
      console.error('❌ 获取每日统计失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取单个发布记录详情
   * GET /api/publish-history/:id
   */
  async getRecordById(req, res) {
    try {
      const { id } = req.params;
      const result = publishHistoryService.getRecordById(parseInt(id));

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('❌ 获取记录详情失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 清理旧记录
   * POST /api/publish-history/cleanup
   */
  async cleanupOldRecords(req, res) {
    try {
      const { days = 90 } = req.body;
      const count = publishHistoryService.cleanupOldRecords(parseInt(days));

      res.json({
        success: true,
        message: `已清理 ${count} 条旧记录`,
        count
      });
    } catch (error) {
      console.error('❌ 清理旧记录失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new HistoryController();
