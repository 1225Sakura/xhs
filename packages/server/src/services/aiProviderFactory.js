import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * AI提供商基类
 * 定义所有提供商必须实现的接口
 */
class BaseAIProvider {
  constructor(config) {
    this.config = config;
    this.name = config.provider_name;
    this.provider = config.provider;
    this.apiKey = config.api_key;
    this.baseURL = config.api_base_url;
    this.timeout = config.timeout || 60000;
  }

  /**
   * 调用AI API生成内容
   * @abstract
   * @param {Object} params - 生成参数
   * @returns {Promise<Object>} - 生成结果
   */
  async generate(params) {
    throw new Error('generate() 方法必须被子类实现');
  }

  /**
   * 测试连接
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      // 子类可以重写此方法
      return true;
    } catch (error) {
      return false;
    }
  }
}


/**
 * DeepSeek 提供商
 * 使用OpenAI兼容API
 */
class DeepSeekProvider extends BaseAIProvider {
  async generate(params) {
    const { model, messages, maxTokens = 2048 } = params;

    const requestData = {
      model: model || 'deepseek-chat',
      messages,
      max_tokens: maxTokens
    };

    const config = {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: this.timeout
    };

    // 代理支持
    if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      config.httpsAgent = new HttpsProxyAgent(proxyUrl);
    }

    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      requestData,
      config
    );

    const choice = response.data.choices[0];

    return {
      content: choice.message.content,
      usage: response.data.usage
    };
  }
}

/**
 * AI提供商工厂
 */
class AIProviderFactory {
  /**
   * 提供商类映射
   */
  static providers = {
    deepseek: DeepSeekProvider
  };

  /**
   * 创建提供商实例
   * @param {string} provider - 提供商标识
   * @param {Object} config - 提供商配置
   * @returns {BaseAIProvider} - 提供商实例
   */
  static createProvider(provider, config) {
    const ProviderClass = this.providers[provider];

    if (!ProviderClass) {
      throw new Error(`不支持的AI提供商: ${provider}`);
    }

    return new ProviderClass(config);
  }

  /**
   * 获取支持的提供商列表
   * @returns {Array<string>}
   */
  static getSupportedProviders() {
    return Object.keys(this.providers);
  }

  /**
   * 检查提供商是否支持
   * @param {string} provider
   * @returns {boolean}
   */
  static isSupported(provider) {
    return provider in this.providers;
  }
}

export default AIProviderFactory;
export {
  BaseAIProvider,
  DeepSeekProvider
};
