import schedulerService from '../services/schedulerService.js';

/**
 * 定时发布控制器
 */
class ScheduleController {
  /**
   * 创建定时任务
   * POST /api/schedules
   */
  async createSchedule(req, res) {
    try {
      const {
        post_id,
        schedule_type,
        scheduled_time,
        schedule_config,
        max_retries
      } = req.body;

      const result = schedulerService.createSchedule({
        post_id,
        schedule_type,
        scheduled_time,
        schedule_config,
        max_retries
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('❌ 创建定时任务失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取所有定时任务
   * GET /api/schedules
   */
  async getSchedules(req, res) {
    try {
      const { status, post_id, schedule_type } = req.query;

      const result = schedulerService.getSchedules({
        status,
        post_id: post_id ? parseInt(post_id) : null,
        schedule_type
      });

      res.json(result);
    } catch (error) {
      console.error('❌ 获取定时任务失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取任务执行日志
   * GET /api/schedules/:id/logs
   */
  async getExecutionLogs(req, res) {
    try {
      const { id } = req.params;

      const result = schedulerService.getExecutionLogs(parseInt(id));
      res.json(result);
    } catch (error) {
      console.error('❌ 获取执行日志失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 更新定时任务
   * PUT /api/schedules/:id
   */
  async updateSchedule(req, res) {
    try {
      const { id } = req.params;
      const {
        scheduled_time,
        schedule_config,
        max_retries
      } = req.body;

      const result = schedulerService.updateSchedule(parseInt(id), {
        scheduled_time,
        schedule_config,
        max_retries
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('❌ 更新定时任务失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 取消定时任务
   * POST /api/schedules/:id/cancel
   */
  async cancelSchedule(req, res) {
    try {
      const { id } = req.params;

      const result = schedulerService.cancelSchedule(parseInt(id));

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('❌ 取消定时任务失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 删除定时任务
   * DELETE /api/schedules/:id
   */
  async deleteSchedule(req, res) {
    try {
      const { id } = req.params;

      const result = schedulerService.deleteSchedule(parseInt(id));

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('❌ 删除定时任务失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 手动触发任务执行（用于测试）
   * POST /api/schedules/:id/execute
   */
  async executeNow(req, res) {
    try {
      const { id } = req.params;

      // 获取任务
      const schedules = schedulerService.getSchedules({});
      if (!schedules.success) {
        return res.status(500).json(schedules);
      }

      const job = schedules.data.find(s => s.id === parseInt(id));

      if (!job) {
        return res.status(404).json({
          success: false,
          error: '任务不存在'
        });
      }

      // 执行任务
      await schedulerService.executeJob(job);

      res.json({
        success: true,
        message: '任务已执行'
      });
    } catch (error) {
      console.error('❌ 手动执行任务失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new ScheduleController();
