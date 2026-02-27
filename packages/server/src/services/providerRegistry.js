import db from '../models/database.js';
import { encrypt, decrypt, maskSensitive } from '../utils/crypto.js';
import AIProviderFactory from './aiProviderFactory.js';
import NodeCache from 'node-cache';

// 提供商配置缓存（TTL: 5分钟）
const providerCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * AI提供商注册表服务
 * 管理AI提供商的配置、API密钥加密存储、连接测试
 */
class ProviderRegistry {
  /**
   * 从数据库加载所有提供商配置
   * @returns {Array} 提供商配置列表
   */
  loadProviders() {
    try {
      const cached = providerCache.get('all_providers');
      if (cached) {
        return cached;
      }

      const providers = db.prepare(`
        SELECT id, provider, provider_name, api_key_encrypted, api_base_url,
               is_enabled, priority, timeout, max_retries, created_at, updated_at
        FROM ai_providers
        ORDER BY priority DESC
      `).all();

      // 解密API密钥（仅在需要时）
      const providersWithDecryption = providers.map(p => ({
        ...p,
        has_api_key: !!p.api_key_encrypted,
        api_key_masked: p.api_key_encrypted ? maskSensitive(decrypt(p.api_key_encrypted)) : null
      }));

      providerCache.set('all_providers', providersWithDecryption);
      return providersWithDecryption;
    } catch (error) {
      console.error('❌ 加载提供商配置失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取已启用的提供商（按优先级排序）
   * @returns {Array} 已启用的提供商列表
   */
  getActiveProviders() {
    try {
      const allProviders = this.loadProviders();
      return allProviders.filter(p => p.is_enabled === 1);
    } catch (error) {
      console.error('❌ 获取已启用提供商失败:', error.message);
      throw error;
    }
  }

  /**
   * 根据provider名称获取配置
   * @param {string} provider - 提供商标识（如 'deepseek'）
   * @returns {Object|null} 提供商配置
   */
  getProvider(provider) {
    try {
      const allProviders = this.loadProviders();
      const found = allProviders.find(p => p.provider === provider);

      if (!found) {
        return null;
      }

      // 解密API密钥
      if (found.api_key_encrypted) {
        found.api_key = decrypt(found.api_key_encrypted);
      }

      return found;
    } catch (error) {
      console.error(`❌ 获取提供商 ${provider} 配置失败:`, error.message);
      throw error;
    }
  }

  /**
   * 保存或更新提供商配置
   * @param {Object} config - 提供商配置
   * @param {string} config.provider - 提供商标识
   * @param {string} config.provider_name - 提供商显示名称
   * @param {string} config.api_key - API密钥（明文，会自动加密）
   * @param {string} config.api_base_url - API基础URL
   * @param {boolean} config.is_enabled - 是否启用
   * @param {number} config.priority - 优先级
   * @param {number} config.timeout - 超时时间（毫秒）
   * @param {number} config.max_retries - 最大重试次数
   * @returns {Object} 保存后的配置
   */
  saveProvider(config) {
    try {
      const {
        provider,
        provider_name,
        api_key,
        api_base_url,
        is_enabled = 1,
        priority = 0,
        timeout = 60000,
        max_retries = 3
      } = config;

      if (!provider || !provider_name) {
        throw new Error('provider 和 provider_name 是必填字段');
      }

      // 加密API密钥
      const api_key_encrypted = api_key ? encrypt(api_key) : null;

      // 检查是否已存在
      const existing = db.prepare(`
        SELECT id FROM ai_providers WHERE provider = ?
      `).get(provider);

      if (existing) {
        // 更新
        const updateStmt = db.prepare(`
          UPDATE ai_providers
          SET provider_name = ?,
              api_key_encrypted = COALESCE(?, api_key_encrypted),
              api_base_url = ?,
              is_enabled = ?,
              priority = ?,
              timeout = ?,
              max_retries = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE provider = ?
        `);

        updateStmt.run(
          provider_name,
          api_key_encrypted,
          api_base_url,
          is_enabled,
          priority,
          timeout,
          max_retries,
          provider
        );

        console.log(`✅ 更新提供商配置: ${provider}`);
      } else {
        // 插入
        const insertStmt = db.prepare(`
          INSERT INTO ai_providers (
            provider, provider_name, api_key_encrypted, api_base_url,
            is_enabled, priority, timeout, max_retries
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(
          provider,
          provider_name,
          api_key_encrypted,
          api_base_url,
          is_enabled,
          priority,
          timeout,
          max_retries
        );

        console.log(`✅ 新增提供商配置: ${provider}`);
      }

      // 清除缓存
      providerCache.del('all_providers');

      return this.getProvider(provider);
    } catch (error) {
      console.error('❌ 保存提供商配置失败:', error.message);
      throw error;
    }
  }

  /**
   * 删除提供商配置
   * @param {string} provider - 提供商标识
   */
  deleteProvider(provider) {
    try {
      db.prepare(`DELETE FROM ai_providers WHERE provider = ?`).run(provider);
      providerCache.del('all_providers');
      console.log(`✅ 删除提供商配置: ${provider}`);
    } catch (error) {
      console.error(`❌ 删除提供商 ${provider} 失败:`, error.message);
      throw error;
    }
  }

  /**
   * 启用/禁用提供商
   * @param {string} provider - 提供商标识
   * @param {boolean} enabled - 是否启用
   */
  toggleProvider(provider, enabled) {
    try {
      db.prepare(`
        UPDATE ai_providers
        SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE provider = ?
      `).run(enabled ? 1 : 0, provider);

      providerCache.del('all_providers');
      console.log(`✅ ${enabled ? '启用' : '禁用'}提供商: ${provider}`);
    } catch (error) {
      console.error(`❌ 切换提供商状态失败:`, error.message);
      throw error;
    }
  }

  /**
   * 更新提供商优先级
   * @param {string} provider - 提供商标识
   * @param {number} priority - 新的优先级
   */
  updatePriority(provider, priority) {
    try {
      db.prepare(`
        UPDATE ai_providers
        SET priority = ?, updated_at = CURRENT_TIMESTAMP
        WHERE provider = ?
      `).run(priority, provider);

      providerCache.del('all_providers');
      console.log(`✅ 更新提供商优先级: ${provider} → ${priority}`);
    } catch (error) {
      console.error(`❌ 更新优先级失败:`, error.message);
      throw error;
    }
  }

  /**
   * 测试提供商连接
   * @param {string} provider - 提供商标识
   * @returns {Promise<Object>} 测试结果 {success, latency, error}
   */
  async testProvider(provider) {
    const startTime = Date.now();

    try {
      const config = this.getProvider(provider);

      if (!config) {
        throw new Error(`提供商 ${provider} 不存在`);
      }

      if (!config.api_key) {
        throw new Error(`提供商 ${provider} 未配置API密钥`);
      }

      // 调用实际的AI API进行连接测试
      try {
        const provider = AIProviderFactory.createProvider(config.provider, {
          api_key: config.api_key,
          api_base_url: config.api_base_url,
          timeout: config.timeout || 30000
        });

        // 发送简单的测试请求
        await provider.testConnection();

        const latency = Date.now() - startTime;
        return {
          success: true,
          latency,
          message: `连接测试成功 (${latency}ms)`
        };
      } catch (testError) {
        const latency = Date.now() - startTime;
        return {
          success: false,
          latency,
          error: testError.message
        };
      }
    } catch (error) {
      const latency = Date.now() - startTime;

      return {
        success: false,
        latency,
        error: error.message
      };
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    providerCache.flushAll();
    console.log('✅ 提供商缓存已清除');
  }
}

// 导出单例
export default new ProviderRegistry();
