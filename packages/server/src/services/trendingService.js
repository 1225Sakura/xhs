import axios from 'axios';
import db from '../models/database.js';

/**
 * 热点数据聚合服务
 * 支持微博、百度、头条、B站热搜数据抓取
 */
class TrendingService {
  constructor() {
    this.platforms = ['weibo', 'baidu', 'toutiao', 'bilibili'];
    this.isRefreshing = false;
    this.lastRefreshTime = null;
  }

  /**
   * 抓取所有平台热点
   */
  async fetchAllPlatforms() {
    console.log('🔥 开始抓取所有平台热点...');

    const results = [];

    for (const platform of this.platforms) {
      try {
        const result = await this.fetchPlatform(platform);
        results.push(result);
      } catch (error) {
        console.error(`❌ 抓取 ${platform} 失败:`, error.message);
        results.push({
          platform,
          success: false,
          error: error.message
        });
      }
    }

    this.lastRefreshTime = new Date().toISOString();

    return {
      success: true,
      data: results,
      refreshTime: this.lastRefreshTime
    };
  }

  /**
   * 抓取指定平台热点
   */
  async fetchPlatform(platform) {
    const startTime = Date.now();

    try {
      console.log(`🔍 抓取 ${platform} 热点...`);

      let topics = [];

      switch (platform) {
        case 'weibo':
          topics = await this.fetchWeibo();
          break;
        case 'baidu':
          topics = await this.fetchBaidu();
          break;
        case 'toutiao':
          topics = await this.fetchToutiao();
          break;
        case 'bilibili':
          topics = await this.fetchBilibili();
          break;
        default:
          throw new Error(`不支持的平台: ${platform}`);
      }

      const duration = Date.now() - startTime;

      // 保存到数据库
      const savedCount = this.saveTopics(platform, topics);

      // 记录抓取日志
      db.prepare(`
        INSERT INTO trending_fetch_logs (platform, status, topics_count, duration_ms)
        VALUES (?, 'success', ?, ?)
      `).run(platform, savedCount, duration);

      console.log(`✅ ${platform} 抓取成功: ${savedCount} 个热点 (${duration}ms)`);

      return {
        platform,
        success: true,
        topics_count: savedCount,
        duration_ms: duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(`❌ ${platform} 抓取失败:`, error.message);

      // 记录失败日志
      db.prepare(`
        INSERT INTO trending_fetch_logs (platform, status, topics_count, duration_ms, error_message)
        VALUES (?, 'failed', 0, ?, ?)
      `).run(platform, duration, error.message);

      throw error;
    }
  }

  /**
   * 抓取微博热搜
   */
  async fetchWeibo() {
    try {
      // 方法1: 尝试使用微博热搜API
      try {
        const response = await axios.get('https://weibo.com/ajax/side/hotSearch', {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://weibo.com',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
          }
        });

        const data = response.data;
        const topics = [];

        if (data && data.data && data.data.realtime) {
          data.data.realtime.forEach((item, index) => {
            topics.push({
              topic_id: `weibo_${item.word}`,
              title: item.word,
              description: item.word_scheme || item.note || item.word,
              url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word)}`,
              hot_score: parseInt(item.num) || 0,
              rank_position: index + 1,
              category: item.category || 'general'
            });
          });
        }

        if (topics.length > 0) {
          return topics;
        }
      } catch (error) {
        console.log('⚠️ 微博官方API失败，尝试备用方案:', error.message);
      }

      // 方法2: 使用第三方聚合API（备用）
      try {
        const response = await axios.get('https://tenapi.cn/v2/weibohot', {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const data = response.data;
        const topics = [];

        if (data && data.code === 200 && data.data) {
          data.data.forEach((item, index) => {
            if (item.title && index < 50) { // 限制50条
              topics.push({
                topic_id: `weibo_${item.title}`,
                title: item.title,
                description: item.desc || item.title,
                url: item.url || `https://s.weibo.com/weibo?q=${encodeURIComponent(item.title)}`,
                hot_score: parseInt(item.hot) || 0,
                rank_position: index + 1,
                category: 'general'
              });
            }
          });
        }

        if (topics.length > 0) {
          console.log(`✅ 使用备用API获取微博热搜: ${topics.length} 条`);
          return topics;
        }
      } catch (error) {
        console.log('⚠️ 微博备用API也失败:', error.message);
      }

      // 如果所有方法都失败，返回空数组
      console.log('⚠️ 微博热搜暂时无法获取，可能需要更新API');
      return [];
    } catch (error) {
      console.error('❌ 抓取微博热搜失败:', error.message);
      return [];
    }
  }

  /**
   * 抓取百度热搜
   */
  async fetchBaidu() {
    try {
      // 使用百度热搜API
      const response = await axios.get('https://top.baidu.com/api/board?tab=realtime', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const data = response.data;
      const topics = [];

      if (data && data.data && data.data.cards) {
        data.data.cards.forEach(card => {
          if (card.content) {
            card.content.forEach((item, index) => {
              topics.push({
                topic_id: `baidu_${item.word}`,
                title: item.word,
                description: item.desc || item.word,
                url: item.url || `https://www.baidu.com/s?wd=${encodeURIComponent(item.word)}`,
                hot_score: parseInt(item.hotScore) || 0,
                rank_position: index + 1,
                category: 'general'
              });
            });
          }
        });
      }

      return topics;
    } catch (error) {
      console.error('❌ 抓取百度热搜失败:', error.message);
      return [];
    }
  }

  /**
   * 抓取今日头条热榜
   */
  async fetchToutiao() {
    try {
      // 使用今日头条热榜API
      const response = await axios.get('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const data = response.data;
      const topics = [];

      if (data && data.data) {
        data.data.forEach((item, index) => {
          topics.push({
            topic_id: `toutiao_${item.ClusterIdStr}`,
            title: item.Title,
            description: item.Abstract || item.Title,
            url: item.Url || `https://www.toutiao.com/search/?keyword=${encodeURIComponent(item.Title)}`,
            hot_score: parseInt(item.HotValue) || 0,
            rank_position: index + 1,
            category: item.LabelType || 'general',
            image_url: item.Image?.url || null
          });
        });
      }

      return topics;
    } catch (error) {
      console.error('❌ 抓取今日头条热榜失败:', error.message);
      return [];
    }
  }

  /**
   * 抓取B站热搜
   */
  async fetchBilibili() {
    try {
      // 使用B站热搜API
      const response = await axios.get('https://api.bilibili.com/x/web-interface/wbi/search/square?limit=50', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.bilibili.com'
        }
      });

      const data = response.data;
      const topics = [];

      if (data && data.data && data.data.trending) {
        data.data.trending.list.forEach((item, index) => {
          topics.push({
            topic_id: `bilibili_${item.keyword}`,
            title: item.keyword,
            description: item.show_name || item.keyword,
            url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(item.keyword)}`,
            hot_score: parseInt(item.hot_id) || 0,
            rank_position: index + 1,
            category: 'video',
            image_url: item.icon || null
          });
        });
      }

      return topics;
    } catch (error) {
      console.error('❌ 抓取B站热搜失败:', error.message);
      return [];
    }
  }

  /**
   * 保存热点到数据库
   */
  saveTopics(platform, topics) {
    if (!topics || topics.length === 0) {
      return 0;
    }

    let savedCount = 0;

    // 使用事务批量插入/更新
    const insertOrUpdate = db.prepare(`
      INSERT INTO trending_topics (
        platform, topic_id, title, description, url,
        hot_score, rank_position, category, image_url, view_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform, topic_id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        url = excluded.url,
        hot_score = excluded.hot_score,
        rank_position = excluded.rank_position,
        category = excluded.category,
        image_url = excluded.image_url,
        last_updated_at = CURRENT_TIMESTAMP,
        is_active = 1
    `);

    const transaction = db.transaction((topicsList) => {
      for (const topic of topicsList) {
        insertOrUpdate.run(
          platform,
          topic.topic_id,
          topic.title,
          topic.description || null,
          topic.url || null,
          topic.hot_score || 0,
          topic.rank_position || 0,
          topic.category || 'general',
          topic.image_url || null,
          topic.view_count || 0
        );
        savedCount++;
      }
    });

    transaction(topics);

    return savedCount;
  }

  /**
   * 搜索热点话题
   */
  searchTopics(options = {}) {
    try {
      const {
        keyword = null,
        platform = null,
        category = null,
        limit = 50,
        sortBy = 'hot_score' // hot_score, rank_position, last_updated_at
      } = options;

      let whereClause = 'WHERE is_active = 1';
      const params = [];

      if (keyword) {
        whereClause += ' AND (title LIKE ? OR description LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }

      if (platform) {
        whereClause += ' AND platform = ?';
        params.push(platform);
      }

      if (category) {
        whereClause += ' AND category = ?';
        params.push(category);
      }

      // 排序
      let orderClause = '';
      switch (sortBy) {
        case 'rank_position':
          orderClause = 'ORDER BY rank_position ASC';
          break;
        case 'last_updated_at':
          orderClause = 'ORDER BY last_updated_at DESC';
          break;
        case 'hot_score':
        default:
          orderClause = 'ORDER BY hot_score DESC';
          break;
      }

      const query = `
        SELECT * FROM trending_topics
        ${whereClause}
        ${orderClause}
        LIMIT ?
      `;

      const topics = db.prepare(query).all(...params, limit);

      return {
        success: true,
        data: topics
      };
    } catch (error) {
      console.error('❌ 搜索热点失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取热点话题列表（按平台）
   */
  getTopicsByPlatform(platform, limit = 20) {
    try {
      const topics = db.prepare(`
        SELECT * FROM trending_topics
        WHERE platform = ? AND is_active = 1
        ORDER BY rank_position ASC
        LIMIT ?
      `).all(platform, limit);

      return {
        success: true,
        data: topics
      };
    } catch (error) {
      console.error('❌ 获取热点话题失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取抓取日志
   */
  getFetchLogs(limit = 50) {
    try {
      const logs = db.prepare(`
        SELECT * FROM trending_fetch_logs
        ORDER BY fetch_time DESC
        LIMIT ?
      `).all(limit);

      return {
        success: true,
        data: logs
      };
    } catch (error) {
      console.error('❌ 获取抓取日志失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 将热点关联到文案
   */
  linkTopicToPost(postId, topicId) {
    try {
      db.prepare(`
        INSERT INTO post_trending_topics (post_id, trending_topic_id)
        VALUES (?, ?)
        ON CONFLICT DO NOTHING
      `).run(postId, topicId);

      return {
        success: true,
        message: '关联成功'
      };
    } catch (error) {
      console.error('❌ 关联热点失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 清理旧热点（标记为不活跃）
   */
  cleanupOldTopics(days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffDateStr = cutoffDate.toISOString();

      const result = db.prepare(`
        UPDATE trending_topics
        SET is_active = 0
        WHERE last_updated_at < ?
      `).run(cutoffDateStr);

      console.log(`✅ 清理了 ${result.changes} 个旧热点 (${days}天前)`);

      return result.changes;
    } catch (error) {
      console.error('❌ 清理旧热点失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    try {
      const stats = {};

      // 按平台统计
      const byPlatform = db.prepare(`
        SELECT
          platform,
          COUNT(*) as count,
          AVG(hot_score) as avg_score
        FROM trending_topics
        WHERE is_active = 1
        GROUP BY platform
      `).all();

      stats.by_platform = byPlatform;

      // 总数
      const total = db.prepare(`
        SELECT COUNT(*) as total FROM trending_topics WHERE is_active = 1
      `).get();

      stats.total = total.total;

      // 最近更新时间
      const lastUpdate = db.prepare(`
        SELECT MAX(last_updated_at) as last_update FROM trending_topics
      `).get();

      stats.last_update = lastUpdate.last_update;

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('❌ 获取统计信息失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new TrendingService();
