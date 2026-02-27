import providerRegistry from '../services/providerRegistry.js';
import AIProviderFactory from '../services/aiProviderFactory.js';
import db from '../models/database.js';

/**
 * AI提供商管理控制器
 */
class AIProviderController {
  /**
   * 获取所有AI提供商配置
   * GET /api/ai/providers
   */
  async getAllProviders(req, res) {
    try {
      const providers = providerRegistry.loadProviders();

      // 不返回解密后的API密钥，只返回掩码版本
      const safeProviders = providers.map(p => ({
        id: p.id,
        provider: p.provider,
        provider_name: p.provider_name,
        api_base_url: p.api_base_url,
        is_enabled: p.is_enabled,
        priority: p.priority,
        timeout: p.timeout,
        max_retries: p.max_retries,
        has_api_key: p.has_api_key,
        api_key_masked: p.api_key_masked,
        created_at: p.created_at,
        updated_at: p.updated_at
      }));

      res.json({
        success: true,
        data: safeProviders
      });
    } catch (error) {
      console.error('❌ 获取提供商列表失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取单个提供商配置（不包含API密钥）
   * GET /api/ai/providers/:provider
   */
  async getProvider(req, res) {
    try {
      const { provider } = req.params;
      const config = providerRegistry.getProvider(provider);

      if (!config) {
        return res.status(404).json({
          success: false,
          error: `提供商 ${provider} 不存在`
        });
      }

      // 移除敏感信息
      const safeConfig = {
        id: config.id,
        provider: config.provider,
        provider_name: config.provider_name,
        api_base_url: config.api_base_url,
        is_enabled: config.is_enabled,
        priority: config.priority,
        timeout: config.timeout,
        max_retries: config.max_retries,
        has_api_key: !!config.api_key,
        created_at: config.created_at,
        updated_at: config.updated_at
      };

      res.json({
        success: true,
        data: safeConfig
      });
    } catch (error) {
      console.error('❌ 获取提供商配置失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 更新提供商配置
   * PUT /api/ai/providers/:provider
   */
  async updateProvider(req, res) {
    try {
      const { provider } = req.params;
      const {
        provider_name,
        api_key,
        api_base_url,
        is_enabled,
        priority,
        timeout,
        max_retries
      } = req.body;

      // 验证必填字段
      if (!provider_name) {
        return res.status(400).json({
          success: false,
          error: 'provider_name 是必填字段'
        });
      }

      // 构建配置对象
      const config = {
        provider,
        provider_name,
        api_base_url,
        is_enabled: is_enabled !== undefined ? is_enabled : 1,
        priority: priority !== undefined ? priority : 0,
        timeout: timeout || 60000,
        max_retries: max_retries !== undefined ? max_retries : 3
      };

      // 只有提供了新API密钥时才更新
      if (api_key) {
        config.api_key = api_key;
      }

      // 保存配置
      const saved = providerRegistry.saveProvider(config);

      res.json({
        success: true,
        message: '提供商配置已保存',
        data: {
          provider: saved.provider,
          provider_name: saved.provider_name,
          is_enabled: saved.is_enabled,
          priority: saved.priority
        }
      });
    } catch (error) {
      console.error('❌ 更新提供商配置失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 启用/禁用提供商
   * POST /api/ai/providers/:provider/toggle
   */
  async toggleProvider(req, res) {
    try {
      const { provider } = req.params;
      const { enabled } = req.body;

      if (enabled === undefined) {
        return res.status(400).json({
          success: false,
          error: 'enabled 参数是必填的'
        });
      }

      providerRegistry.toggleProvider(provider, enabled);

      res.json({
        success: true,
        message: `提供商已${enabled ? '启用' : '禁用'}`
      });
    } catch (error) {
      console.error('❌ 切换提供商状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 更新提供商优先级
   * POST /api/ai/providers/:provider/priority
   */
  async updatePriority(req, res) {
    try {
      const { provider } = req.params;
      const { priority } = req.body;

      if (priority === undefined) {
        return res.status(400).json({
          success: false,
          error: 'priority 参数是必填的'
        });
      }

      providerRegistry.updatePriority(provider, priority);

      res.json({
        success: true,
        message: '优先级已更新'
      });
    } catch (error) {
      console.error('❌ 更新优先级失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 测试提供商连接
   * POST /api/ai/providers/:provider/test
   */
  async testProvider(req, res) {
    try {
      const { provider } = req.params;

      console.log(`🔍 测试提供商连接: ${provider}`);

      // 获取提供商配置
      const config = providerRegistry.getProvider(provider);

      if (!config) {
        return res.status(404).json({
          success: false,
          error: `提供商 ${provider} 不存在`
        });
      }

      if (!config.api_key) {
        return res.status(400).json({
          success: false,
          error: `提供商 ${provider} 未配置API密钥`
        });
      }

      // 创建提供商实例
      const providerInstance = AIProviderFactory.createProvider(provider, config);

      // 执行简单的测试调用
      const startTime = Date.now();
      try {
        const result = await providerInstance.generate({
          model: config.default_model || 'test-model',
          messages: [{ role: 'user', content: '测试连接，请回复"OK"' }],
          maxTokens: 10
        });

        const latency = Date.now() - startTime;

        console.log(`✅ 提供商 ${provider} 连接测试成功 (${latency}ms)`);

        res.json({
          success: true,
          latency,
          message: `连接测试成功 (${latency}ms)`,
          response: result.content ? result.content.substring(0, 50) : 'OK'
        });
      } catch (testError) {
        const latency = Date.now() - startTime;

        console.error(`❌ 提供商 ${provider} 连接测试失败:`, testError.message);

        res.json({
          success: false,
          latency,
          error: testError.message
        });
      }
    } catch (error) {
      console.error('❌ 测试提供商失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取AI使用统计
   * GET /api/ai/usage-stats
   */
  async getUsageStats(req, res) {
    try {
      const { days = 7, provider = null, operation = null } = req.query;

      // 构建查询条件
      let whereClause = `WHERE created_at >= datetime('now', '-${days} days')`;
      const params = [];

      if (provider) {
        whereClause += ` AND provider = ?`;
        params.push(provider);
      }

      if (operation) {
        whereClause += ` AND operation = ?`;
        params.push(operation);
      }

      // 总体统计
      const totalStats = db.prepare(`
        SELECT
          COUNT(*) as total_calls,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_calls,
          SUM(tokens_used) as total_tokens,
          SUM(cost) as total_cost,
          AVG(duration_ms) as avg_duration_ms
        FROM ai_usage_logs
        ${whereClause}
      `).get(...params);

      // 按提供商统计
      const providerStats = db.prepare(`
        SELECT
          provider,
          COUNT(*) as calls,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
          SUM(tokens_used) as tokens,
          SUM(cost) as cost,
          AVG(duration_ms) as avg_duration
        FROM ai_usage_logs
        ${whereClause}
        GROUP BY provider
        ORDER BY calls DESC
      `).all(...params);

      // 按模型统计
      const modelStats = db.prepare(`
        SELECT
          model,
          COUNT(*) as calls,
          SUM(tokens_used) as tokens,
          SUM(cost) as cost
        FROM ai_usage_logs
        ${whereClause}
        GROUP BY model
        ORDER BY calls DESC
      `).all(...params);

      // 按操作类型统计
      const operationStats = db.prepare(`
        SELECT
          operation,
          COUNT(*) as calls,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          AVG(duration_ms) as avg_duration
        FROM ai_usage_logs
        ${whereClause}
        GROUP BY operation
        ORDER BY calls DESC
      `).all(...params);

      // 每日趋势（最近N天）
      const dailyTrend = db.prepare(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as calls,
          SUM(tokens_used) as tokens,
          SUM(cost) as cost
        FROM ai_usage_logs
        ${whereClause}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT ${days}
      `).all(...params);

      res.json({
        success: true,
        data: {
          period_days: parseInt(days),
          total: totalStats,
          by_provider: providerStats,
          by_model: modelStats,
          by_operation: operationStats,
          daily_trend: dailyTrend
        }
      });
    } catch (error) {
      console.error('❌ 获取使用统计失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 删除提供商配置
   * DELETE /api/ai/providers/:provider
   */
  async deleteProvider(req, res) {
    try {
      const { provider } = req.params;

      providerRegistry.deleteProvider(provider);

      res.json({
        success: true,
        message: '提供商配置已删除'
      });
    } catch (error) {
      console.error('❌ 删除提供商失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 清除提供商缓存
   * POST /api/ai/providers/cache/clear
   */
  async clearCache(req, res) {
    try {
      providerRegistry.clearCache();

      res.json({
        success: true,
        message: '缓存已清除'
      });
    } catch (error) {
      console.error('❌ 清除缓存失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 获取支持的提供商列表
   * GET /api/ai/providers/supported
   */
  async getSupportedProviders(req, res) {
    try {
      const supported = AIProviderFactory.getSupportedProviders();

      const providerInfo = [
        {
          provider: 'deepseek',
          name: 'DeepSeek',
          default_models: [
            { name: 'deepseek-chat', price: 0.001 },
            { name: 'deepseek-reasoner', price: 0.002 }
          ]
        }
      ];

      res.json({
        success: true,
        data: providerInfo.filter(p => supported.includes(p.provider))
      });
    } catch (error) {
      console.error('❌ 获取支持的提供商失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new AIProviderController();
