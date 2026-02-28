import logger from '../utils/logger.js';
import db from '../models/database.js';

class MetricsController {
  // 导出Prometheus格式的指标
  exportMetrics(req, res) {
    try {
      const metrics = [];
      const timestamp = Date.now();

      // 1. 客户端总数
      const clientStats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
          SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline
        FROM clients
      `).get();

      metrics.push(`# HELP xhs_clients_total Total number of clients`);
      metrics.push(`# TYPE xhs_clients_total gauge`);
      metrics.push(`xhs_clients_total ${clientStats.total} ${timestamp}`);

      metrics.push(`# HELP xhs_clients_online Number of online clients`);
      metrics.push(`# TYPE xhs_clients_online gauge`);
      metrics.push(`xhs_clients_online ${clientStats.online} ${timestamp}`);

      metrics.push(`# HELP xhs_clients_offline Number of offline clients`);
      metrics.push(`# TYPE xhs_clients_offline gauge`);
      metrics.push(`xhs_clients_offline ${clientStats.offline} ${timestamp}`);

      // 2. 用户总数
      const userStats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
          SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as users
        FROM users
      `).get();

      metrics.push(`# HELP xhs_users_total Total number of users`);
      metrics.push(`# TYPE xhs_users_total gauge`);
      metrics.push(`xhs_users_total ${userStats.total} ${timestamp}`);

      metrics.push(`# HELP xhs_users_admins Number of admin users`);
      metrics.push(`# TYPE xhs_users_admins gauge`);
      metrics.push(`xhs_users_admins ${userStats.admins} ${timestamp}`);

      // 3. 许可证统计
      const licenseStats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN expires_at IS NOT NULL AND datetime(expires_at) < datetime('now') THEN 1 ELSE 0 END) as expired
        FROM licenses
      `).get();

      metrics.push(`# HELP xhs_licenses_total Total number of licenses`);
      metrics.push(`# TYPE xhs_licenses_total gauge`);
      metrics.push(`xhs_licenses_total ${licenseStats.total} ${timestamp}`);

      metrics.push(`# HELP xhs_licenses_active Number of active licenses`);
      metrics.push(`# TYPE xhs_licenses_active gauge`);
      metrics.push(`xhs_licenses_active ${licenseStats.active} ${timestamp}`);

      // 4. 客户端平均指标（最近1小时）
      const avgMetrics = db.prepare(`
        SELECT
          AVG(cpu_usage) as avg_cpu,
          AVG(memory_usage) as avg_memory,
          AVG(disk_usage) as avg_disk
        FROM client_metrics
        WHERE timestamp > datetime('now', '-1 hour')
      `).get();

      if (avgMetrics.avg_cpu !== null) {
        metrics.push(`# HELP xhs_avg_cpu_usage Average CPU usage across all clients`);
        metrics.push(`# TYPE xhs_avg_cpu_usage gauge`);
        metrics.push(`xhs_avg_cpu_usage ${avgMetrics.avg_cpu.toFixed(2)} ${timestamp}`);

        metrics.push(`# HELP xhs_avg_memory_usage Average memory usage across all clients`);
        metrics.push(`# TYPE xhs_avg_memory_usage gauge`);
        metrics.push(`xhs_avg_memory_usage ${avgMetrics.avg_memory.toFixed(2)} ${timestamp}`);

        metrics.push(`# HELP xhs_avg_disk_usage Average disk usage across all clients`);
        metrics.push(`# TYPE xhs_avg_disk_usage gauge`);
        metrics.push(`xhs_avg_disk_usage ${avgMetrics.avg_disk.toFixed(2)} ${timestamp}`);
      }

      // 5. 每个客户端的最新指标
      const clientMetrics = db.prepare(`
        SELECT
          cm.client_id,
          cm.cpu_usage,
          cm.memory_usage,
          cm.disk_usage,
          c.hostname,
          c.platform
        FROM client_metrics cm
        INNER JOIN clients c ON cm.client_id = c.client_id
        WHERE cm.timestamp = (
          SELECT MAX(timestamp)
          FROM client_metrics
          WHERE client_id = cm.client_id
        )
      `).all();

      clientMetrics.forEach(m => {
        const labels = `client_id="${m.client_id}",hostname="${m.hostname}",platform="${m.platform || 'unknown'}"`;

        if (m.cpu_usage !== null) {
          metrics.push(`xhs_client_cpu_usage{${labels}} ${m.cpu_usage} ${timestamp}`);
        }
        if (m.memory_usage !== null) {
          metrics.push(`xhs_client_memory_usage{${labels}} ${m.memory_usage} ${timestamp}`);
        }
        if (m.disk_usage !== null) {
          metrics.push(`xhs_client_disk_usage{${labels}} ${m.disk_usage} ${timestamp}`);
        }
      });

      // 返回Prometheus格式
      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.send(metrics.join('\n'));
    } catch (error) {
      logger.error('导出指标失败:', error);
      res.status(500).send('# Error exporting metrics\n');
    }
  }

  // 获取指标汇总（管理员）
  getMetricsSummary(req, res) {
    try {
      // 客户端统计
      const clientStats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
          SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline
        FROM clients
      `).get();

      // 用户统计
      const userStats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins
        FROM users
      `).get();

      // 许可证统计
      const licenseStats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
        FROM licenses
      `).get();

      // 平均指标（最近1小时）
      const avgMetrics = db.prepare(`
        SELECT
          AVG(cpu_usage) as avg_cpu,
          AVG(memory_usage) as avg_memory,
          AVG(disk_usage) as avg_disk,
          COUNT(*) as data_points
        FROM client_metrics
        WHERE timestamp > datetime('now', '-1 hour')
      `).get();

      // 数据同步统计
      const syncStats = db.prepare(`
        SELECT
          COUNT(DISTINCT client_id) as clients_with_data,
          COUNT(DISTINCT data_type) as data_types,
          COUNT(*) as total_records
        FROM sync_data
      `).get();

      res.json({
        success: true,
        data: {
          clients: clientStats,
          users: userStats,
          licenses: licenseStats,
          metrics: {
            avgCpu: avgMetrics.avg_cpu ? parseFloat(avgMetrics.avg_cpu.toFixed(2)) : 0,
            avgMemory: avgMetrics.avg_memory ? parseFloat(avgMetrics.avg_memory.toFixed(2)) : 0,
            avgDisk: avgMetrics.avg_disk ? parseFloat(avgMetrics.avg_disk.toFixed(2)) : 0,
            dataPoints: avgMetrics.data_points
          },
          sync: syncStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('获取指标汇总失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get metrics summary'
      });
    }
  }
}

export default new MetricsController();
