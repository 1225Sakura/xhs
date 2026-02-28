import logger from '../utils/logger.js';
import db from '../models/database.js';

class SyncController {
  // 上传数据
  upload(req, res) {
    try {
      const { clientId, dataType, data } = req.body;

      if (!clientId || !dataType || !data) {
        return res.status(400).json({
          success: false,
          error: 'clientId, dataType and data are required'
        });
      }

      // 检查是否已存在该类型的数据
      const existing = db.prepare(`
        SELECT id, version FROM sync_data
        WHERE client_id = ? AND data_type = ?
        ORDER BY version DESC LIMIT 1
      `).get(clientId, dataType);

      const newVersion = existing ? existing.version + 1 : 1;
      const dataContent = typeof data === 'object' ? JSON.stringify(data) : String(data);

      // 插入新版本数据
      db.prepare(`
        INSERT INTO sync_data (client_id, data_type, data_content, version, uploaded_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(clientId, dataType, dataContent, newVersion);

      logger.info(`数据已上传: ${clientId}, ${dataType}, v${newVersion}`);

      res.json({
        success: true,
        data: {
          clientId,
          dataType,
          version: newVersion
        }
      });
    } catch (error) {
      logger.error('上传数据失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload data'
      });
    }
  }

  // 下载数据
  download(req, res) {
    try {
      const { clientId } = req.params;
      const { dataType, version } = req.query;

      let query = `
        SELECT data_type, data_content, version, uploaded_at
        FROM sync_data
        WHERE client_id = ?
      `;
      const params = [clientId];

      if (dataType) {
        query += ' AND data_type = ?';
        params.push(dataType);
      }

      if (version) {
        query += ' AND version = ?';
        params.push(parseInt(version));
      } else {
        // 如果没有指定版本，获取每种类型的最新版本
        query = `
          SELECT data_type, data_content, version, uploaded_at
          FROM sync_data
          WHERE client_id = ?
          ${dataType ? 'AND data_type = ?' : ''}
          AND version = (
            SELECT MAX(version)
            FROM sync_data AS s2
            WHERE s2.client_id = sync_data.client_id
            AND s2.data_type = sync_data.data_type
          )
        `;
      }

      query += ' ORDER BY data_type, version DESC';

      const results = db.prepare(query).all(...params);

      // 解析JSON数据
      const data = results.map(row => {
        let content;
        try {
          content = JSON.parse(row.data_content);
        } catch {
          content = row.data_content;
        }

        return {
          dataType: row.data_type,
          data: content,
          version: row.version,
          uploadedAt: row.uploaded_at
        };
      });

      res.json({
        success: true,
        data: {
          clientId,
          items: data,
          count: data.length
        }
      });
    } catch (error) {
      logger.error('下载数据失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download data'
      });
    }
  }

  // 上传指标数据（客户端）
  uploadMetrics(req, res) {
    try {
      const { clientId, metrics } = req.body;

      if (!clientId || !metrics) {
        return res.status(400).json({
          success: false,
          error: 'clientId and metrics are required'
        });
      }

      // 保存指标数据
      db.prepare(`
        INSERT INTO client_metrics (client_id, cpu_usage, memory_usage, disk_usage, timestamp)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(
        clientId,
        metrics.cpu || null,
        metrics.memory || null,
        metrics.disk || null
      );

      res.json({
        success: true,
        message: 'Metrics uploaded successfully'
      });
    } catch (error) {
      logger.error('上传指标失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload metrics'
      });
    }
  }

  // 获取客户端指标（管理员）
  getMetrics(req, res) {
    try {
      const { clientId } = req.params;
      const { limit = 100 } = req.query;

      const metrics = db.prepare(`
        SELECT cpu_usage, memory_usage, disk_usage, timestamp
        FROM client_metrics
        WHERE client_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(clientId, parseInt(limit));

      res.json({
        success: true,
        data: {
          clientId,
          metrics,
          count: metrics.length
        }
      });
    } catch (error) {
      logger.error('获取指标失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get metrics'
      });
    }
  }
}

export default new SyncController();
