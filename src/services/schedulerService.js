import db from '../models/database.js';
import logger from '../utils/logger.js';
import multiAccountPublishService from './multiAccountPublishService.js';
import publishHistoryService from './publishHistoryService.js';

/**
 * 定时发布调度服务
 * 支持一次性、每日、每周、每月定时发布，自动重试
 */
class SchedulerService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 60 * 1000; // 每分钟检查一次
  }

  /**
   * 启动调度器
   */
  start() {
    if (this.isRunning) {
      logger.info('⏰ 调度器已在运行');
      return;
    }

    logger.info('⏰ 启动定时发布调度器...');
    this.isRunning = true;

    // 立即执行一次检查
    this.tick();

    // 设置定时检查
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.checkInterval);

    logger.info(`✅ 调度器已启动 (检查间隔: ${this.checkInterval / 1000}秒)`);
  }

  /**
   * 停止调度器
   */
  stop() {
    if (!this.isRunning) {
      logger.info('⏰ 调度器未运行');
      return;
    }

    logger.info('⏰ 停止定时发布调度器...');
    clearInterval(this.intervalId);
    this.isRunning = false;
    this.intervalId = null;
    logger.info('✅ 调度器已停止');
  }

  /**
   * 调度器时钟周期
   */
  async tick() {
    try {
      const now = new Date().toISOString();

      // 查找所有需要执行的任务
      const jobs = db.prepare(`
        SELECT * FROM scheduled_posts
        WHERE status = 'pending'
        AND next_run_at <= ?
        ORDER BY next_run_at ASC
      `).all(now);

      if (jobs.length > 0) {
        logger.info(`⏰ 发现 ${jobs.length} 个待执行的定时任务`);
      }

      // 执行每个任务
      for (const job of jobs) {
        await this.executeJob(job);
      }
    } catch (error) {
      logger.error('❌ 调度器tick失败:', error.message);
    }
  }

  /**
   * 执行单个定时任务
   */
  async executeJob(job) {
    const startTime = Date.now();
    logger.info(`🚀 执行定时任务 #${job.id} (post_id: ${job.post_id})`);

    try {
      // 获取文案信息
      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(job.post_id);

      if (!post) {
        throw new Error(`文案 ${job.post_id} 不存在`);
      }

      // 解析图片
      let images = [];
      try {
        images = JSON.parse(post.images || '[]');
      } catch (e) {
        images = [];
      }

      if (!images || images.length === 0) {
        throw new Error('文案没有图片，无法发布');
      }

      // 解析标签
      let tags = [];
      try {
        tags = JSON.parse(post.tags || '[]');
      } catch (e) {
        tags = [];
      }

      // 发布到小红书
      const result = await multiAccountPublishService.publishNote(
        post.title,
        post.content,
        images,
        schedule.account_id
      );

      const duration = Date.now() - startTime;

      // 检查发布结果
      const isActualError = result.data && result.data.raw && result.data.raw.isError;
      const hasNoteId = result.data && result.data.note_id;
      const isPublished = result.data &&
        (result.data.status === '发布完成' || result.data.status === 'published');

      if (!result.success || isActualError || (!hasNoteId && !isPublished)) {
        throw new Error(result.data?.message || result.error || '发布失败');
      }

      // 更新文案状态
      db.prepare(`
        UPDATE posts
        SET status = 'published',
            xiaohongshu_id = ?,
            published_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(result.data.note_id || '', job.post_id);

      // 记录成功的执行日志
      db.prepare(`
        INSERT INTO scheduled_execution_logs (
          scheduled_post_id, execution_time, status, duration_ms, publish_response
        ) VALUES (?, ?, 'success', ?, ?)
      `).run(
        job.id,
        new Date().toISOString(),
        duration,
        JSON.stringify(result.data)
      );

      // 记录发布历史
      publishHistoryService.recordAttempt({
        post_id: job.post_id,
        platform: 'xiaohongshu',
        status: 'success',
        xiaohongshu_id: result.data.note_id || '',
        note_url: result.data.note_url || '',
        duration_ms: duration,
        response: JSON.stringify(result.data),
        images_count: images.length,
        content_length: post.content ? post.content.length : 0
      });

      logger.info(`✅ 定时任务 #${job.id} 执行成功`);

      // 处理后续调度
      this.handlePostExecution(job, true);

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ 定时任务 #${job.id} 执行失败:`, error.message);

      // 记录失败的执行日志
      db.prepare(`
        INSERT INTO scheduled_execution_logs (
          scheduled_post_id, execution_time, status, duration_ms, error_message
        ) VALUES (?, ?, 'failed', ?, ?)
      `).run(
        job.id,
        new Date().toISOString(),
        duration,
        error.message
      );

      // 记录发布历史
      publishHistoryService.recordAttempt({
        post_id: job.post_id,
        platform: 'xiaohongshu',
        status: 'failed',
        duration_ms: duration,
        error_message: error.message,
        retry_count: job.retry_count,
        is_retry: job.retry_count > 0 ? 1 : 0
      });

      // 处理重试逻辑
      this.handlePostExecution(job, false, error.message);
    }
  }

  /**
   * 处理任务执行后的状态更新
   */
  handlePostExecution(job, success, errorMessage = null) {
    try {
      const config = job.schedule_config ? JSON.parse(job.schedule_config) : {};

      if (success) {
        // 成功执行
        if (job.schedule_type === 'once') {
          // 一次性任务，标记为已完成
          db.prepare(`
            UPDATE scheduled_posts
            SET status = 'completed'
            WHERE id = ?
          `).run(job.id);
          logger.info(`✅ 一次性任务 #${job.id} 已完成`);
        } else {
          // 循环任务，计算下次执行时间
          const nextRun = this.calculateNextRun(job.schedule_type, config);
          db.prepare(`
            UPDATE scheduled_posts
            SET next_run_at = ?,
                retry_count = 0,
                last_error = NULL
            WHERE id = ?
          `).run(nextRun, job.id);
          logger.info(`✅ 循环任务 #${job.id} 下次执行时间: ${nextRun}`);
        }
      } else {
        // 执行失败，处理重试
        const newRetryCount = job.retry_count + 1;

        if (newRetryCount >= job.max_retries) {
          // 达到最大重试次数，标记为失败
          db.prepare(`
            UPDATE scheduled_posts
            SET status = 'failed',
                last_error = ?
            WHERE id = ?
          `).run(errorMessage, job.id);
          logger.info(`❌ 任务 #${job.id} 达到最大重试次数，标记为失败`);
        } else {
          // 更新重试次数，延迟1小时后重试
          const nextRetry = new Date();
          nextRetry.setHours(nextRetry.getHours() + 1);

          db.prepare(`
            UPDATE scheduled_posts
            SET retry_count = ?,
                next_run_at = ?,
                last_error = ?
            WHERE id = ?
          `).run(newRetryCount, nextRetry.toISOString(), errorMessage, job.id);
          logger.info(`⏰ 任务 #${job.id} 将在1小时后重试 (第${newRetryCount}次)`);
        }
      }
    } catch (error) {
      logger.error('❌ 处理任务执行后状态失败:', error.message);
    }
  }

  /**
   * 计算下次执行时间
   */
  calculateNextRun(scheduleType, config) {
    const now = new Date();

    switch (scheduleType) {
      case 'daily': {
        // 每日定时：config.time = "HH:MM"
        const [hours, minutes] = (config.time || '09:00').split(':').map(Number);
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);

        // 如果今天的时间已过，推到明天
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }

        return next.toISOString();
      }

      case 'weekly': {
        // 每周定时：config.dayOfWeek = 0-6 (0=Sunday), config.time = "HH:MM"
        const targetDay = config.dayOfWeek || 1; // 默认周一
        const [hours, minutes] = (config.time || '09:00').split(':').map(Number);

        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);

        // 计算到目标星期几需要的天数
        const currentDay = next.getDay();
        let daysUntilTarget = targetDay - currentDay;

        if (daysUntilTarget < 0 || (daysUntilTarget === 0 && next <= now)) {
          daysUntilTarget += 7;
        }

        next.setDate(next.getDate() + daysUntilTarget);
        return next.toISOString();
      }

      case 'monthly': {
        // 每月定时：config.dayOfMonth = 1-31, config.time = "HH:MM"
        const targetDay = Math.min(config.dayOfMonth || 1, 28); // 限制在1-28避免月末问题
        const [hours, minutes] = (config.time || '09:00').split(':').map(Number);

        const next = new Date(now);
        next.setDate(targetDay);
        next.setHours(hours, minutes, 0, 0);

        // 如果这个月的日期已过，推到下个月
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }

        return next.toISOString();
      }

      default:
        throw new Error(`不支持的调度类型: ${scheduleType}`);
    }
  }

  /**
   * 创建定时任务
   */
  createSchedule(data) {
    try {
      const {
        post_id,
        schedule_type,
        scheduled_time,
        schedule_config = {},
        max_retries = 3
      } = data;

      // 验证
      if (!post_id) {
        throw new Error('post_id 是必填的');
      }

      if (!['once', 'daily', 'weekly', 'monthly'].includes(schedule_type)) {
        throw new Error('schedule_type 必须是 once, daily, weekly, monthly 之一');
      }

      // 计算首次执行时间
      let nextRunAt;
      if (schedule_type === 'once') {
        if (!scheduled_time) {
          throw new Error('一次性任务必须指定 scheduled_time');
        }
        nextRunAt = scheduled_time;
      } else {
        nextRunAt = this.calculateNextRun(schedule_type, schedule_config);
      }

      // 插入数据库
      const result = db.prepare(`
        INSERT INTO scheduled_posts (
          post_id, schedule_type, scheduled_time, schedule_config,
          next_run_at, max_retries
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        post_id,
        schedule_type,
        scheduled_time || nextRunAt,
        JSON.stringify(schedule_config),
        nextRunAt,
        max_retries
      );

      logger.info(`✅ 创建定时任务: post_id=${post_id}, type=${schedule_type}, next_run=${nextRunAt}`);

      return {
        success: true,
        data: {
          id: result.lastInsertRowid,
          post_id,
          schedule_type,
          next_run_at: nextRunAt
        }
      };
    } catch (error) {
      logger.error('❌ 创建定时任务失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取所有定时任务
   */
  getSchedules(filters = {}) {
    try {
      const {
        status = null,
        post_id = null,
        schedule_type = null
      } = filters;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (status) {
        whereClause += ' AND sp.status = ?';
        params.push(status);
      }

      if (post_id) {
        whereClause += ' AND sp.post_id = ?';
        params.push(post_id);
      }

      if (schedule_type) {
        whereClause += ' AND sp.schedule_type = ?';
        params.push(schedule_type);
      }

      const schedules = db.prepare(`
        SELECT
          sp.*,
          p.title as post_title,
          p.status as post_status
        FROM scheduled_posts sp
        LEFT JOIN posts p ON sp.post_id = p.id
        ${whereClause}
        ORDER BY sp.next_run_at ASC
      `).all(...params);

      return {
        success: true,
        data: schedules.map(s => ({
          ...s,
          schedule_config: s.schedule_config ? JSON.parse(s.schedule_config) : {}
        }))
      };
    } catch (error) {
      logger.error('❌ 获取定时任务失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取任务执行日志
   */
  getExecutionLogs(scheduledPostId) {
    try {
      const logs = db.prepare(`
        SELECT * FROM scheduled_execution_logs
        WHERE scheduled_post_id = ?
        ORDER BY execution_time DESC
        LIMIT 50
      `).all(scheduledPostId);

      return {
        success: true,
        data: logs
      };
    } catch (error) {
      logger.error('❌ 获取执行日志失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 取消定时任务
   */
  cancelSchedule(id) {
    try {
      const result = db.prepare(`
        UPDATE scheduled_posts
        SET status = 'cancelled'
        WHERE id = ?
      `).run(id);

      if (result.changes === 0) {
        return {
          success: false,
          error: '任务不存在'
        };
      }

      logger.info(`✅ 取消定时任务 #${id}`);

      return {
        success: true,
        message: '任务已取消'
      };
    } catch (error) {
      logger.error('❌ 取消定时任务失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 更新定时任务
   */
  updateSchedule(id, data) {
    try {
      const {
        scheduled_time,
        schedule_config,
        max_retries
      } = data;

      // 获取现有任务
      const existing = db.prepare('SELECT * FROM scheduled_posts WHERE id = ?').get(id);

      if (!existing) {
        return {
          success: false,
          error: '任务不存在'
        };
      }

      // 更新配置
      const newConfig = schedule_config || JSON.parse(existing.schedule_config || '{}');

      // 重新计算下次执行时间
      let nextRunAt;
      if (existing.schedule_type === 'once') {
        nextRunAt = scheduled_time || existing.scheduled_time;
      } else {
        nextRunAt = this.calculateNextRun(existing.schedule_type, newConfig);
      }

      // 更新数据库
      db.prepare(`
        UPDATE scheduled_posts
        SET scheduled_time = COALESCE(?, scheduled_time),
            schedule_config = ?,
            next_run_at = ?,
            max_retries = COALESCE(?, max_retries),
            status = 'pending',
            retry_count = 0
        WHERE id = ?
      `).run(
        scheduled_time,
        JSON.stringify(newConfig),
        nextRunAt,
        max_retries,
        id
      );

      logger.info(`✅ 更新定时任务 #${id}`);

      return {
        success: true,
        message: '任务已更新',
        data: { next_run_at: nextRunAt }
      };
    } catch (error) {
      logger.error('❌ 更新定时任务失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除定时任务
   */
  deleteSchedule(id) {
    try {
      const result = db.prepare('DELETE FROM scheduled_posts WHERE id = ?').run(id);

      if (result.changes === 0) {
        return {
          success: false,
          error: '任务不存在'
        };
      }

      logger.info(`✅ 删除定时任务 #${id}`);

      return {
        success: true,
        message: '任务已删除'
      };
    } catch (error) {
      logger.error('❌ 删除定时任务失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new SchedulerService();
