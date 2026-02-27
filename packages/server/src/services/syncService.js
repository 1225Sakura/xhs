const db = require('../models/cloudDatabase');
const logger = require('../utils/logger');

class SyncService {
  // 上传数据
  async uploadData(clientId, dataType, data) {
    try {
      const promises = data.map(item => {
        return db.query(
          `INSERT INTO sync_queue (client_id, data_type, action, data, synced)
           VALUES ($1, $2, $3, $4, true)`,
          [clientId, dataType, item.action || 'create', JSON.stringify(item)]
        );
      });

      await Promise.all(promises);

      return { success: true, count: data.length };
    } catch (error) {
      logger.error('Failed to upload data:', error);
      throw error;
    }
  }

  // 下载数据
  async downloadData(clientId, since) {
    try {
      const sinceDate = since ? new Date(since) : new Date(0);

      const result = await db.query(
        `SELECT * FROM sync_queue
         WHERE client_id = $1 AND created_at > $2
         ORDER BY created_at ASC`,
        [clientId, sinceDate]
      );

      return result.rows.map(row => ({
        id: row.id,
        dataType: row.data_type,
        action: row.action,
        data: row.data,
        createdAt: row.created_at
      }));
    } catch (error) {
      logger.error('Failed to download data:', error);
      throw error;
    }
  }

  // 上报指标
  async uploadMetrics(clientId, timestamp, metrics) {
    try {
      // 解析Prometheus格式的指标
      const lines = metrics.split('\n');
      const promises = [];

      for (const line of lines) {
        if (line.startsWith('#') || !line.trim()) continue;

        const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}\s+([0-9.]+)/);
        if (match) {
          const [, metricName, labelsStr, value] = match;
          const labels = {};

          // 解析标签
          const labelPairs = labelsStr.split(',');
          for (const pair of labelPairs) {
            const [key, val] = pair.split('=');
            if (key && val) {
              labels[key.trim()] = val.trim().replace(/"/g, '');
            }
          }

          promises.push(
            db.query(
              `INSERT INTO metrics (client_id, metric_name, metric_value, labels, timestamp)
               VALUES ($1, $2, $3, $4, $5)`,
              [clientId, metricName, parseFloat(value), JSON.stringify(labels), new Date(timestamp)]
            )
          );
        }
      }

      await Promise.all(promises);

      return { success: true, count: promises.length };
    } catch (error) {
      logger.error('Failed to upload metrics:', error);
      throw error;
    }
  }

  // 获取指标
  async getMetrics(clientId, metricName, startTime, endTime) {
    try {
      let query = 'SELECT * FROM metrics WHERE client_id = $1';
      const params = [clientId];
      let paramIndex = 2;

      if (metricName) {
        query += ` AND metric_name = $${paramIndex}`;
        params.push(metricName);
        paramIndex++;
      }

      if (startTime) {
        query += ` AND timestamp >= $${paramIndex}`;
        params.push(new Date(startTime));
        paramIndex++;
      }

      if (endTime) {
        query += ` AND timestamp <= $${paramIndex}`;
        params.push(new Date(endTime));
        paramIndex++;
      }

      query += ' ORDER BY timestamp DESC LIMIT 1000';

      const result = await db.query(query, params);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get metrics:', error);
      throw error;
    }
  }
}

module.exports = new SyncService();
