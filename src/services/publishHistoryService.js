import db from '../models/database.js';
import { createObjectCsvStringifier } from 'csv-writer';

/**
 * 发布历史服务
 * 提供详细的发布记录追踪、统计分析、CSV导出功能
 */
class PublishHistoryService {
  /**
   * 记录发布尝试
   * @param {Object} data - 发布记录数据
   * @returns {number} - 记录ID
   */
  recordAttempt(data) {
    try {
      const {
        post_id,
        platform = 'xiaohongshu',
        status,
        xiaohongshu_id = null,
        note_url = null,
        retry_count = 0,
        is_retry = 0,
        original_attempt_id = null,
        duration_ms = null,
        upload_duration_ms = null,
        publish_duration_ms = null,
        error_code = null,
        error_message = null,
        error_details = null,
        response = null,
        images_count = 0,
        content_length = 0
      } = data;

      const result = db.prepare(`
        INSERT INTO publish_history (
          post_id, platform, status, xiaohongshu_id, note_url,
          retry_count, is_retry, original_attempt_id,
          duration_ms, upload_duration_ms, publish_duration_ms,
          error_code, error_message, error_details, response,
          images_count, content_length
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        post_id, platform, status, xiaohongshu_id, note_url,
        retry_count, is_retry, original_attempt_id,
        duration_ms, upload_duration_ms, publish_duration_ms,
        error_code, error_message, error_details, response,
        images_count, content_length
      );

      console.log(`✅ 记录发布历史: post_id=${post_id}, status=${status}`);

      // 更新每日统计
      this.updateDailyStats(status, duration_ms, is_retry);

      return result.lastInsertRowid;
    } catch (error) {
      console.error('❌ 记录发布历史失败:', error.message);
      throw error;
    }
  }

  /**
   * 更新每日统计
   */
  updateDailyStats(status, duration_ms, is_retry) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 获取今天的统计
      const existing = db.prepare(`
        SELECT * FROM publish_stats_daily WHERE stat_date = ?
      `).get(today);

      if (existing) {
        // 更新统计
        const updates = {
          total_attempts: existing.total_attempts + 1,
          successful_publishes: status === 'success' ? existing.successful_publishes + 1 : existing.successful_publishes,
          failed_publishes: status === 'failed' ? existing.failed_publishes + 1 : existing.failed_publishes,
          total_retries: is_retry ? existing.total_retries + 1 : existing.total_retries
        };

        // 计算平均耗时
        if (duration_ms) {
          const totalDuration = (existing.avg_duration_ms || 0) * existing.total_attempts + duration_ms;
          updates.avg_duration_ms = Math.round(totalDuration / updates.total_attempts);
        }

        db.prepare(`
          UPDATE publish_stats_daily
          SET total_attempts = ?,
              successful_publishes = ?,
              failed_publishes = ?,
              total_retries = ?,
              avg_duration_ms = ?
          WHERE stat_date = ?
        `).run(
          updates.total_attempts,
          updates.successful_publishes,
          updates.failed_publishes,
          updates.total_retries,
          updates.avg_duration_ms,
          today
        );
      } else {
        // 插入新记录
        db.prepare(`
          INSERT INTO publish_stats_daily (
            stat_date, total_attempts, successful_publishes,
            failed_publishes, total_retries, avg_duration_ms
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          today,
          1,
          status === 'success' ? 1 : 0,
          status === 'failed' ? 1 : 0,
          is_retry ? 1 : 0,
          duration_ms || 0
        );
      }
    } catch (error) {
      console.error('❌ 更新每日统计失败:', error.message);
    }
  }

  /**
   * 获取发布历史记录
   * @param {Object} options - 查询选项
   * @returns {Object} - { records, total, page, pageSize }
   */
  getHistory(options = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        status = null,
        post_id = null,
        platform = null,
        startDate = null,
        endDate = null,
        is_retry = null
      } = options;

      // 构建查询条件
      let whereClause = 'WHERE 1=1';
      const params = [];

      if (status) {
        whereClause += ' AND ph.status = ?';
        params.push(status);
      }

      if (post_id) {
        whereClause += ' AND ph.post_id = ?';
        params.push(post_id);
      }

      if (platform) {
        whereClause += ' AND ph.platform = ?';
        params.push(platform);
      }

      if (startDate) {
        whereClause += ' AND ph.created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND ph.created_at <= ?';
        params.push(endDate);
      }

      if (is_retry !== null) {
        whereClause += ' AND ph.is_retry = ?';
        params.push(is_retry ? 1 : 0);
      }

      // 计算总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM publish_history ph
        ${whereClause}
      `;
      const { total } = db.prepare(countQuery).get(...params);

      // 获取记录
      const offset = (page - 1) * pageSize;
      const query = `
        SELECT
          ph.*,
          p.title as post_title,
          p.ai_model as post_model,
          p.ai_provider as post_provider
        FROM publish_history ph
        LEFT JOIN posts p ON ph.post_id = p.id
        ${whereClause}
        ORDER BY ph.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const records = db.prepare(query).all(...params, pageSize, offset);

      return {
        success: true,
        data: {
          records,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('❌ 获取发布历史失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取统计数据
   * @param {Object} options - 统计选项
   * @returns {Object} - 统计结果
   */
  getStats(options = {}) {
    try {
      const {
        days = 30,
        post_id = null
      } = options;

      // 构建时间范围
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString();

      let whereClause = 'WHERE created_at >= ?';
      const params = [startDateStr];

      if (post_id) {
        whereClause += ' AND post_id = ?';
        params.push(post_id);
      }

      // 总体统计
      const overall = db.prepare(`
        SELECT
          COUNT(*) as total_attempts,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN is_retry = 1 THEN 1 ELSE 0 END) as retries,
          AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms END) as avg_duration_ms,
          AVG(CASE WHEN upload_duration_ms IS NOT NULL THEN upload_duration_ms END) as avg_upload_duration_ms,
          AVG(CASE WHEN publish_duration_ms IS NOT NULL THEN publish_duration_ms END) as avg_publish_duration_ms,
          MIN(duration_ms) as min_duration_ms,
          MAX(duration_ms) as max_duration_ms
        FROM publish_history
        ${whereClause}
      `).get(...params);

      // 计算成功率
      overall.success_rate = overall.total_attempts > 0
        ? (overall.successful / overall.total_attempts * 100).toFixed(2)
        : 0;

      // 按状态分组
      const byStatus = db.prepare(`
        SELECT
          status,
          COUNT(*) as count,
          AVG(duration_ms) as avg_duration
        FROM publish_history
        ${whereClause}
        GROUP BY status
        ORDER BY count DESC
      `).all(...params);

      // 错误分析
      const errorAnalysis = db.prepare(`
        SELECT
          error_code,
          error_message,
          COUNT(*) as count,
          MAX(created_at) as last_occurrence
        FROM publish_history
        ${whereClause} AND status = 'failed'
        GROUP BY error_code, error_message
        ORDER BY count DESC
        LIMIT 10
      `).all(...params);

      // 每日趋势
      const dailyTrend = db.prepare(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          AVG(duration_ms) as avg_duration
        FROM publish_history
        ${whereClause}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT ${days}
      `).all(...params);

      // 平台统计
      const byPlatform = db.prepare(`
        SELECT
          platform,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful
        FROM publish_history
        ${whereClause}
        GROUP BY platform
      `).all(...params);

      // 重试统计
      const retryStats = db.prepare(`
        SELECT
          retry_count,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful
        FROM publish_history
        ${whereClause}
        GROUP BY retry_count
        ORDER BY retry_count
      `).all(...params);

      return {
        success: true,
        data: {
          period_days: days,
          overall,
          by_status: byStatus,
          error_analysis: errorAnalysis,
          daily_trend: dailyTrend,
          by_platform: byPlatform,
          retry_stats: retryStats
        }
      };
    } catch (error) {
      console.error('❌ 获取统计数据失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 导出为CSV格式
   * @param {Object} options - 导出选项
   * @returns {string} - CSV内容
   */
  async exportToCSV(options = {}) {
    try {
      const {
        status = null,
        startDate = null,
        endDate = null,
        limit = 10000
      } = options;

      // 构建查询
      let whereClause = 'WHERE 1=1';
      const params = [];

      if (status) {
        whereClause += ' AND ph.status = ?';
        params.push(status);
      }

      if (startDate) {
        whereClause += ' AND ph.created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND ph.created_at <= ?';
        params.push(endDate);
      }

      // 获取数据
      const query = `
        SELECT
          ph.id,
          ph.post_id,
          p.title as post_title,
          ph.platform,
          ph.status,
          ph.xiaohongshu_id,
          ph.note_url,
          ph.retry_count,
          ph.is_retry,
          ph.duration_ms,
          ph.upload_duration_ms,
          ph.publish_duration_ms,
          ph.error_code,
          ph.error_message,
          ph.images_count,
          ph.content_length,
          p.ai_provider,
          p.ai_model,
          ph.created_at
        FROM publish_history ph
        LEFT JOIN posts p ON ph.post_id = p.id
        ${whereClause}
        ORDER BY ph.created_at DESC
        LIMIT ?
      `;

      const records = db.prepare(query).all(...params, limit);

      // 创建CSV
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'id', title: 'ID' },
          { id: 'post_id', title: 'Post ID' },
          { id: 'post_title', title: 'Post Title' },
          { id: 'platform', title: 'Platform' },
          { id: 'status', title: 'Status' },
          { id: 'xiaohongshu_id', title: 'XHS ID' },
          { id: 'note_url', title: 'Note URL' },
          { id: 'retry_count', title: 'Retry Count' },
          { id: 'is_retry', title: 'Is Retry' },
          { id: 'duration_ms', title: 'Duration (ms)' },
          { id: 'upload_duration_ms', title: 'Upload Duration (ms)' },
          { id: 'publish_duration_ms', title: 'Publish Duration (ms)' },
          { id: 'error_code', title: 'Error Code' },
          { id: 'error_message', title: 'Error Message' },
          { id: 'images_count', title: 'Images Count' },
          { id: 'content_length', title: 'Content Length' },
          { id: 'ai_provider', title: 'AI Provider' },
          { id: 'ai_model', title: 'AI Model' },
          { id: 'created_at', title: 'Created At' }
        ]
      });

      const csvHeader = csvStringifier.getHeaderString();
      const csvBody = csvStringifier.stringifyRecords(records);

      return {
        success: true,
        data: csvHeader + csvBody,
        count: records.length
      };
    } catch (error) {
      console.error('❌ 导出CSV失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取每日统计
   * @param {number} days - 天数
   * @returns {Array} - 统计数据
   */
  getDailyStats(days = 30) {
    try {
      const stats = db.prepare(`
        SELECT *
        FROM publish_stats_daily
        ORDER BY stat_date DESC
        LIMIT ?
      `).all(days);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('❌ 获取每日统计失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取单个发布记录详情
   * @param {number} id - 记录ID
   * @returns {Object} - 记录详情
   */
  getRecordById(id) {
    try {
      const record = db.prepare(`
        SELECT
          ph.*,
          p.title as post_title,
          p.content as post_content,
          p.ai_model,
          p.ai_provider
        FROM publish_history ph
        LEFT JOIN posts p ON ph.post_id = p.id
        WHERE ph.id = ?
      `).get(id);

      if (!record) {
        return {
          success: false,
          error: '记录不存在'
        };
      }

      return {
        success: true,
        data: record
      };
    } catch (error) {
      console.error('❌ 获取记录详情失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除旧记录（数据清理）
   * @param {number} days - 保留最近N天的记录
   * @returns {number} - 删除的记录数
   */
  cleanupOldRecords(days = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffDateStr = cutoffDate.toISOString();

      const result = db.prepare(`
        DELETE FROM publish_history
        WHERE created_at < ?
      `).run(cutoffDateStr);

      console.log(`✅ 清理了 ${result.changes} 条旧记录 (${days}天前)`);

      return result.changes;
    } catch (error) {
      console.error('❌ 清理旧记录失败:', error.message);
      throw error;
    }
  }
}

export default new PublishHistoryService();
