import trendingService from '../services/trendingService.js';

/**
 * 热点数据控制器
 */
class TrendingController {
  /**
   * 获取所有平台热点
   * GET /api/trending
   */
  async getAllTopics(req, res) {
    try {
      const { keyword, platform, category, limit, sortBy } = req.query;

      const result = trendingService.searchTopics({
        keyword,
        platform,
        category,
        limit: limit ? parseInt(limit) : 50,
        sortBy
      });

      res.json(result);
    } catch (error) {
      console.error('❌ 获取热点失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取指定平台热点
   * GET /api/trending/:platform
   */
  async getPlatformTopics(req, res) {
    try {
      const { platform } = req.params;
      const { limit = 20 } = req.query;

      const result = trendingService.getTopicsByPlatform(platform, parseInt(limit));
      res.json(result);
    } catch (error) {
      console.error('❌ 获取平台热点失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 刷新热点数据
   * POST /api/trending/refresh
   */
  async refreshTopics(req, res) {
    try {
      const { platform } = req.body;

      if (trendingService.isRefreshing) {
        return res.status(429).json({
          success: false,
          error: '正在刷新中，请稍后再试'
        });
      }

      trendingService.isRefreshing = true;

      let result;
      if (platform) {
        // 刷新单个平台
        result = await trendingService.fetchPlatform(platform);
      } else {
        // 刷新所有平台
        result = await trendingService.fetchAllPlatforms();
      }

      trendingService.isRefreshing = false;

      res.json(result);
    } catch (error) {
      trendingService.isRefreshing = false;
      console.error('❌ 刷新热点失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取抓取日志
   * GET /api/trending/logs
   */
  async getFetchLogs(req, res) {
    try {
      const { limit = 50 } = req.query;

      const result = trendingService.getFetchLogs(parseInt(limit));
      res.json(result);
    } catch (error) {
      console.error('❌ 获取抓取日志失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取统计信息
   * GET /api/trending/stats
   */
  async getStats(req, res) {
    try {
      const result = trendingService.getStats();
      res.json(result);
    } catch (error) {
      console.error('❌ 获取统计信息失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 关联热点到文案
   * POST /api/trending/link
   */
  async linkToPost(req, res) {
    try {
      const { post_id, topic_id } = req.body;

      if (!post_id || !topic_id) {
        return res.status(400).json({
          success: false,
          error: 'post_id 和 topic_id 是必填的'
        });
      }

      const result = trendingService.linkTopicToPost(post_id, topic_id);
      res.json(result);
    } catch (error) {
      console.error('❌ 关联热点失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 清理旧热点
   * POST /api/trending/cleanup
   */
  async cleanupOld(req, res) {
    try {
      const { days = 7 } = req.body;

      const count = trendingService.cleanupOldTopics(parseInt(days));

      res.json({
        success: true,
        message: `已清理 ${count} 个旧热点`,
        count
      });
    } catch (error) {
      console.error('❌ 清理旧热点失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new TrendingController();
