import logger from '../utils/logger.js';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import providerRegistry from './providerRegistry.js';
import AIProviderFactory from './aiProviderFactory.js';
import db from '../models/database.js';
import sensitiveWordService from './sensitiveWordService.js';
import * as antiAigcStrategies from '../utils/antiAigcStrategies.js';
import * as promptTemplates from './promptTemplates.js';

// 获取axios配置（包括代理）
function getAxiosConfig() {
  const config = {};
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy) {
    config.httpsAgent = new HttpsProxyAgent(proxy);
    config.proxy = false;
    logger.info('🌐 使用代理:', proxy);
  }
  return config;
}

// AI模型配置
export const AI_MODELS = {
  // DeepSeek 模型
  'deepseek-chat': { name: 'DeepSeek Chat', price: 0.001, provider: 'deepseek' },
  'deepseek-reasoner': { name: 'DeepSeek Reasoner', price: 0.002, provider: 'deepseek' },
};

// 文案风格指南
export const STYLE_GUIDES = {
  '种草型': {
    desc: '重点推荐产品，强调使用效果和真实体验，激发购买欲望',
    tone: '热情推荐、真诚分享',
    structure: '开头引起共鸣 → 产品介绍和使用感受 → 具体效果展示 → 购买建议',
    keywords: ['真香', '强推', '必入', '效果', '实测', '值得']
  },
  '教程型': {
    desc: '提供详细步骤和实用方法，帮助用户解决问题',
    tone: '专业指导、清晰易懂',
    structure: '问题引入 → 准备工作 → 分步骤说明 → 注意事项 → 效果展示',
    keywords: ['教程', '步骤', '方法', '技巧', '攻略', '干货']
  },
  '测评型': {
    desc: '客观评价产品，分析优缺点，提供购买参考',
    tone: '客观公正、详细分析',
    structure: '产品信息 → 使用体验 → 优点总结 → 缺点说明 → 购买建议',
    keywords: ['测评', '实测', '优点', '缺点', '性价比', '值不值']
  },
  '故事型': {
    desc: '通过个人经历讲述与产品相关的故事，引发情感共鸣',
    tone: '真实动人、娓娓道来',
    structure: '背景故事 → 遇到的问题 → 使用产品的转变 → 现在的状态',
    keywords: ['故事', '经历', '改变', '感动', '真实', '分享']
  },
  '清单型': {
    desc: '列举多个要点或推荐，条理清晰便于阅读',
    tone: '简洁明了、重点突出',
    structure: '主题引入 → 逐条展开（序号/emoji） → 每条要点说明 → 总结',
    keywords: ['清单', '盘点', '总结', '合集', '推荐', '必备']
  },
  '问答型': {
    desc: '以问答形式解答用户常见疑问，针对性强',
    tone: '解答疑惑、专业可信',
    structure: 'Q1+A1 → Q2+A2 → Q3+A3 → 总结建议',
    keywords: ['Q&A', '解答', '疑问', '常见问题', '怎么办', '为什么']
  },
  '对比型': {
    desc: '展示使用前后的对比变化，突出产品效果',
    tone: '对比鲜明、效果明显',
    structure: '使用前状况 → 使用过程 → 使用后变化 → 对比总结',
    keywords: ['对比', '前后', '变化', '改善', '效果', '差距']
  },
  '幽默型': {
    desc: '运用轻松幽默的语言，增加内容趣味性和互动',
    tone: '轻松搞笑、活泼有趣',
    structure: '有趣的开场 → 夸张的描述 → 反转的惊喜 → 搞笑的结尾',
    keywords: ['哈哈', '笑死', '绝了', '有意思', '搞笑', '好玩']
  },
  '治愈型': {
    desc: '温暖鼓励的文字，给人正能量和心灵慰藉',
    tone: '温暖治愈、充满力量',
    structure: '共情开场 → 温暖的话语 → 积极的建议 → 鼓励的结尾',
    keywords: ['温暖', '治愈', '陪伴', '美好', '幸福', '珍惜']
  },
  '专业型': {
    desc: '运用专业知识和科学依据，建立权威可信形象',
    tone: '科学严谨、专业权威',
    structure: '专业背景 → 科学原理 → 成分/技术分析 → 专业建议',
    keywords: ['研究', '成分', '原理', '科学', '数据', '专业']
  }
};

/**
 * 清理Markdown格式符号和JSON残留
 */
function cleanMarkdownFormat(text) {
  if (!text) return text;

  return text
    // 去除JSON字段名残留（如 "content": "title": 等）
    .replace(/"(title|content|tags)":\s*/g, '')
    // 去除转义的换行符 \n
    .replace(/\\n/g, '\n')
    // 去除转义的引号 \"
    .replace(/\\"/g, '"')
    // 去除转义的反斜杠 \\
    .replace(/\\\\/g, '')
    // 去除JSON数组括号残留
    .replace(/^\[|\]$/g, '')
    // 去除粗体标记 **text** 或 __text__
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // 去除斜体标记 *text* 或 _text_
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // 去除删除线 ~~text~~
    .replace(/~~(.+?)~~/g, '$1')
    // 去除标题标记 # ## ### 等
    .replace(/^#{1,6}\s+/gm, '')
    // 去除链接 [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 去除图片 ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 去除代码块标记 ```
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // 去除引用标记 >
    .replace(/^>\s+/gm, '')
    // 去除列表标记 - * +
    .replace(/^[\-\*\+]\s+/gm, '')
    // 去除多余空白
    .replace(/\n{3,}/g, '\n\n')
    // 去除开头和结尾的引号
    .replace(/^["']|["']$/g, '')
    .trim();
}

/**
 * 智能截断标题（考虑emoji和中文字符）
 */
function truncateTitle(title, maxLength = 30) {
  if (!title) return '精选推荐';

  // 清理markdown格式
  let cleaned = cleanMarkdownFormat(title);

  // 计算实际显示长度（emoji算2个字符，中文算1个）
  let displayLength = 0;
  let result = '';

  for (let char of cleaned) {
    // emoji通常在这个范围内
    const isEmoji = char.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
    const charLength = isEmoji ? 2 : 1;

    if (displayLength + charLength > maxLength) {
      break;
    }

    result += char;
    displayLength += charLength;
  }

  // 如果被截断了，去掉可能不完整的标点符号
  if (result.length < cleaned.length) {
    result = result.replace(/[:：、，,。！!？?…]$/, '');
  }

  return result.trim() || '精选推荐';
}

/**
 * 记录AI使用日志
 */
function logAIUsage(logData) {
  try {
    const {
      provider, model, post_id = null, operation,
      tokens_used = 0, cost = 0, duration_ms,
      success = 1, error_message = null
    } = logData;

    db.prepare(`
      INSERT INTO ai_usage_logs (
        provider, model, post_id, operation, tokens_used,
        cost, duration_ms, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(provider, model, post_id, operation, tokens_used, cost, duration_ms, success, error_message);
  } catch (error) {
    logger.error('❌ 记录AI使用日志失败:', error.message);
  }
}

/**
 * 使用多提供商回退机制调用AI API
 */
export async function callAIAPIWithFallback(model, messages, maxTokens = 2048, options = {}) {
  const { post_id = null, operation = 'generate' } = options;
  const startTime = Date.now();

  const modelConfig = AI_MODELS[model];
  if (!modelConfig) {
    throw new Error(`不支持的模型: ${model}`);
  }

  // 获取已启用的提供商
  const activeProviders = providerRegistry.getActiveProviders();

  if (activeProviders.length === 0) {
    throw new Error('没有已启用的AI提供商，请先配置API密钥');
  }

  logger.info(`🤖 开始AI调用 (模型: ${model}, 提供商数: ${activeProviders.length})`);

  let lastError = null;
  let attemptCount = 0;

  // 尝试每个已启用的提供商
  for (const providerConfig of activeProviders) {
    attemptCount++;
    const providerName = providerConfig.provider;

    try {
      logger.info(`🔄 尝试提供商 ${attemptCount}/${activeProviders.length}: ${providerConfig.provider_name}`);

      const fullConfig = providerRegistry.getProvider(providerName);
      if (!fullConfig || !fullConfig.api_key) {
        logger.info(`⚠️ 提供商 ${providerName} 未配置API密钥，跳过`);
        continue;
      }

      // 创建提供商实例
      const provider = AIProviderFactory.createProvider(providerName, fullConfig);

      // 调用API
      const callStart = Date.now();
      const result = await provider.generate({ model, messages, maxTokens });
      const duration = Date.now() - callStart;

      // 计算token和成本
      const tokensUsed = (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0);
      const cost = modelConfig.price;

      // 记录成功日志
      logAIUsage({
        provider: providerName, model, post_id, operation,
        tokens_used: tokensUsed, cost, duration_ms: duration, success: 1
      });

      logger.info(`✅ 提供商 ${providerConfig.provider_name} 调用成功 (耗时: ${duration}ms)`);

      return {
        content: result.content,
        usage: result.usage,
        provider: providerName,
        model,
        cost,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      lastError = error;

      logger.error(`❌ 提供商 ${providerConfig.provider_name} 调用失败:`, error.message);

      // 记录失败日志
      logAIUsage({
        provider: providerName, model, post_id, operation,
        tokens_used: 0, cost: 0, duration_ms: duration,
        success: 0, error_message: error.message
      });

      continue;
    }
  }

  const totalDuration = Date.now() - startTime;
  logger.error(`❌ 所有提供商都失败了 (尝试了 ${attemptCount} 个，总耗时: ${totalDuration}ms)`);

  throw new Error(`AI调用失败: ${lastError?.message || '所有提供商均不可用'}`);
}

/**
 * 传统的单提供商调用（向后兼容）
 * @deprecated 建议使用 callAIAPIWithFallback
 */
async function callAIAPI(model, messages, maxTokens = 2048) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

  if (!apiKey) {
    throw new Error('未配置DeepSeek API Key');
  }

  const modelConfig = AI_MODELS[model];
  if (!modelConfig) {
    throw new Error(`不支持的模型: ${model}`);
  }

  const url = `${baseURL.replace(/\/$/, '')}/v1/chat/completions`;
  const requestBody = { model, max_tokens: maxTokens, messages, temperature: 0.7 };
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  const response = await axios.post(url, requestBody, {
    ...getAxiosConfig(),
    headers,
    timeout: 60000,
    maxRedirects: 5
  });

  const choice = response.data.choices?.[0];
  if (!choice) {
    throw new Error('API返回数据格式错误');
  }

  return {
    content: [{ type: 'text', text: choice.message?.content || choice.text || '' }]
  };
}

/**
 * 生成小红书文案（使用多提供商回退）
 */
export async function generateXhsContent(params) {
  const {
    productInfo, knowledgeBase,
    style = '种草型', targetAudience = '大众',
    model = 'deepseek-chat',
    post_id = null
  } = params;

  // 获取风格指南
  const styleGuide = STYLE_GUIDES[style] || STYLE_GUIDES['种草型'];

  const prompt = `你是一个真实的小红书用户，正在分享自己的使用体验。请用最自然、最口语化的方式创作文案，就像和朋友聊天一样。

产品信息：
${JSON.stringify(productInfo, null, 2)}

知识库参考：
${knowledgeBase || '无额外参考'}

创作要求：
- 风格：${style}（${styleGuide.desc}）
- 语气：${styleGuide.tone}
- 内容结构：${styleGuide.structure}
- 建议使用关键词：${styleGuide.keywords.join('、')}
- 目标受众：${targetAudience}

**标题要求（非常重要）：**
- 标题不超过20个字（包括emoji和标点符号）
- 标题必须完整表达核心卖点，不要中途截断
- 标题要简洁有力，可以使用1-2个emoji
- 标题示例："💡实测！基因检测盒真香"（18字）

**正文要求（超级重要）：**
- 字数：800-1000字
- 语言风格：
  * 像朋友聊天一样自然、口语化
  * 多用"我"、"你"、"咱们"等第一/第二人称
  * 可以用"哈哈"、"嘿嘿"、"哇"等语气词
  * 句子长短结合，有节奏感
  * 适当使用反问句、感叹句增加互动感
- Emoji使用（必须）：
  * 正文中至少使用5-8个emoji
  * 在关键句子、情绪表达处加emoji
  * emoji要自然融入，不要堆砌
  * 示例："用了一周，效果真的绝了！✨"、"姐妹们听我说💕"
- 内容真实感：
  * 分享具体的使用场景和细节
  * 提到真实的感受和变化
  * 可以提到小缺点（更真实）
  * 像在记录日常生活一样
- 格式：
  * 纯文本，不用markdown符号（**、##、___等）
  * 自然分段，每段2-4句话
  * 可以用空行分段，让阅读更舒服

**其他要求：**
- 包含3-5个相关话题标签
- 标签不要加#号，系统会自动添加

重要：请**只返回**一个有效的JSON对象，不要包含任何其他文字。
**严格禁止**在标题和正文内容中出现以下内容：
- JSON语法字符和字段名
- 换行转义符或其他转义字符
- Markdown格式符号

严格按照以下格式返回：
{
  "title": "这里是简洁完整的标题（不超过20字）",
  "content": "这里是口语化、有emoji的正文内容（800-1000字），像朋友聊天一样自然",
  "tags": ["标签1", "标签2", "标签3"]
}`;

  try {
    const result = await callAIAPIWithFallback(
      model,
      [{ role: "user", content: prompt }],
      2048,
      { post_id, operation: 'generate' }
    );

    let responseText = result.content;
    if (Array.isArray(responseText) && responseText[0]?.text) {
      responseText = responseText[0].text;
    }

    logger.info('🤖 AI响应长度:', responseText.length);

    // 清理响应
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    responseText = responseText.replace(/"/g, '"').replace(/"/g, '"');

    // 解析JSON
    try {
      let jsonResult = null;

      // 尝试多种JSON提取方式
      try {
        jsonResult = JSON.parse(responseText);
        logger.info('✅ JSON解析成功');
      } catch (e1) {
        // 使用非贪婪匹配提取JSON对象
        const jsonMatch = responseText.match(/\{[\s\S]*?\}(?=\s*$|\s*\n\s*[^}\s])/);
        if (jsonMatch) {
          jsonResult = JSON.parse(jsonMatch[0]);
          logger.info('✅ 正则提取JSON成功');
        } else {
          // 查找第一个完整的JSON对象
          let braceCount = 0;
          let startIndex = -1;
          let endIndex = -1;

          for (let i = 0; i < responseText.length; i++) {
            if (responseText[i] === '{') {
              if (braceCount === 0) startIndex = i;
              braceCount++;
            } else if (responseText[i] === '}') {
              braceCount--;
              if (braceCount === 0 && startIndex !== -1) {
                endIndex = i;
                break;
              }
            }
          }

          if (startIndex !== -1 && endIndex !== -1) {
            const jsonText = responseText.substring(startIndex, endIndex + 1);
            jsonResult = JSON.parse(jsonText);
            logger.info('✅ 括号匹配提取JSON成功');
          } else {
            throw new Error('无法提取JSON对象');
          }
        }
      }

      if (!jsonResult || !jsonResult.title || !jsonResult.content) {
        throw new Error('JSON格式不完整');
      }

      // 清理标题和内容中的markdown格式
      jsonResult.title = cleanMarkdownFormat(jsonResult.title);
      jsonResult.content = cleanMarkdownFormat(jsonResult.content);

      // 智能截断标题（小红书限制20字）
      jsonResult.title = truncateTitle(jsonResult.title, 20);

      // 截断正文（小红书限制1000字）
      if (jsonResult.content.length > 1000) {
        jsonResult.content = jsonResult.content.substring(0, 1000);
        // 去掉可能不完整的最后一句
        const lastPeriod = Math.max(
          jsonResult.content.lastIndexOf('。'),
          jsonResult.content.lastIndexOf('！'),
          jsonResult.content.lastIndexOf('？'),
          jsonResult.content.lastIndexOf('\n')
        );
        if (lastPeriod > 800) {
          jsonResult.content = jsonResult.content.substring(0, lastPeriod + 1);
        }
      }

      if (!Array.isArray(jsonResult.tags)) {
        jsonResult.tags = [];
      }

      logger.info('✅ 文案生成成功');
      logger.info(`  提供商: ${result.provider}`);
      logger.info(`  标题: ${jsonResult.title}`);
      logger.info(`  标题长度: ${jsonResult.title.length} 字符`);

      return {
        success: true,
        data: jsonResult,
        provider: result.provider,
        model: result.model,
        cost: result.cost,
        duration: result.duration
      };
    } catch (parseError) {
      logger.error('❌ JSON解析失败:', parseError.message);

      // 检查是否包含JSON关键字
      if (responseText.includes('"title"') || responseText.includes('"content"')) {
        logger.error('❌ 响应包含JSON关键字但解析失败，可能是格式错误');
        logger.error('原始响应:', responseText.substring(0, 200));
      }

      // 文本解析：过滤掉JSON语法字符
      const lines = responseText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.match(/^[{}\[\],]$/));

      // 如果第一行看起来像JSON，跳过它
      let fallbackTitle = lines[0] || '精选推荐';
      if (fallbackTitle.startsWith('{') || fallbackTitle.startsWith('"')) {
        fallbackTitle = lines[1] || '精选推荐';
      }
      fallbackTitle = truncateTitle(fallbackTitle, 20);

      let fallbackContent = responseText;
      fallbackContent = cleanMarkdownFormat(fallbackContent);

      // 截断正文到1000字
      if (fallbackContent.length > 1000) {
        fallbackContent = fallbackContent.substring(0, 1000);
        const lastPeriod = Math.max(
          fallbackContent.lastIndexOf('。'),
          fallbackContent.lastIndexOf('！'),
          fallbackContent.lastIndexOf('？')
        );
        if (lastPeriod > 800) {
          fallbackContent = fallbackContent.substring(0, lastPeriod + 1);
        }
      }

      return {
        success: true,
        data: {
          title: fallbackTitle,
          content: fallbackContent,
          tags: []
        },
        provider: result.provider,
        model: result.model,
        cost: result.cost,
        warning: 'AI返回格式异常，已使用fallback处理'
      };
    }
  } catch (error) {
    logger.error('❌ AI生成文案失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 优化现有文案
 */
export async function optimizeContent(content, requirements, model = 'deepseek-chat', post_id = null) {
  const prompt = `请优化以下小红书文案：

原文案：
${content}

优化要求：
${requirements}

注意事项：
- **标题不超过20个字**（非常重要，包括emoji和标点符号）
- **正文不超过1000个字**（非常重要）
- 不要使用markdown格式符号（如**、##、___等）
- 内容使用纯文本格式
- 确保标题表达完整，不要中途截断

请按以下JSON格式返回优化后的文案：
{
  "title": "优化后的简洁完整标题（不超过20字）",
  "content": "优化后的纯文本内容（不超过1000字）",
  "tags": ["标签1", "标签2", "标签3"]
}`;

  try {
    const result = await callAIAPIWithFallback(
      model,
      [{ role: "user", content: prompt }],
      2048,
      { post_id, operation: 'optimize' }
    );

    let responseText = result.content;
    if (Array.isArray(responseText) && responseText[0]?.text) {
      responseText = responseText[0].text;
    }

    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    responseText = responseText.replace(/"/g, '"').replace(/"/g, '"');

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const optimized = JSON.parse(jsonMatch[0]);

        // 清理markdown格式
        if (optimized.title) {
          optimized.title = cleanMarkdownFormat(optimized.title);
          optimized.title = truncateTitle(optimized.title, 30);
        }

        if (optimized.content) {
          optimized.content = cleanMarkdownFormat(optimized.content);
        }

        return {
          success: true,
          data: optimized,
          provider: result.provider,
          model: result.model,
          cost: result.cost
        };
      }
    } catch (e) {
      logger.error('解析AI响应失败:', e);
    }

    return {
      success: true,
      data: {
        title: "优化后的文案",
        content: responseText,
        tags: []
      },
      provider: result.provider,
      model: result.model,
      cost: result.cost
    };
  } catch (error) {
    logger.error('AI优化文案失败:', error);
    return { success: false, error: error.message };
  }
}


/**
 * 生成小红书文案（v2.2高级版本）
 * 集成反AIGC策略、敏感词过滤、内容验证
 */
export async function generateXhsContentV2(params) {
  const {
    productInfo, knowledgeBase,
    style = '种草型', targetAudience = '大众',
    model = 'deepseek-chat', post_id = null,
    useAdvancedPrompt = true,
    enableAntiAIGC = process.env.ENABLE_ANTI_AIGC !== 'false',
    enableSensitiveFilter = process.env.ENABLE_SENSITIVE_WORD_FILTER !== 'false',
    hotPosts = null,  // Phase 2: 热门笔记数据
    wordCount = 800   // 目标字数
  } = params;

  const version = hotPosts ? 'v2.3' : 'v2.2';
  logger.info(`🚀 开始生成文案（${version}版本，目标${wordCount}字）`);

  try {
    // 1. 选择Prompt模板
    const prompt = useAdvancedPrompt
      ? promptTemplates.getAdvancedGenerationPrompt(productInfo, knowledgeBase, style, targetAudience, hotPosts, wordCount)
      : promptTemplates.getBasicGenerationPrompt(productInfo, knowledgeBase, style, targetAudience, wordCount);

    // 2. 调用AI生成
    const result = await callAIAPIWithFallback(
      model,
      [{ role: "user", content: prompt }],
      2048,
      { post_id, operation: 'generate' }
    );

    let responseText = result.content;
    if (Array.isArray(responseText) && responseText[0]?.text) {
      responseText = responseText[0].text;
    }

    // 3. 清理响应
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    responseText = responseText.replace(/"/g, '"').replace(/"/g, '"');

    // 4. 解析JSON
    let parsedContent;
    try {
      // 尝试多种JSON提取方式
      let jsonText = null;

      // 方式1: 尝试直接解析整个响应
      try {
        parsedContent = JSON.parse(responseText);
        jsonText = responseText;
      } catch (e) {
        // 方式2: 使用非贪婪匹配提取JSON对象
        const jsonMatch = responseText.match(/\{[\s\S]*?\}(?=\s*$|\s*\n\s*[^}\s])/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
          parsedContent = JSON.parse(jsonText);
        } else {
          // 方式3: 查找第一个完整的JSON对象
          let braceCount = 0;
          let startIndex = -1;
          let endIndex = -1;

          for (let i = 0; i < responseText.length; i++) {
            if (responseText[i] === '{') {
              if (braceCount === 0) startIndex = i;
              braceCount++;
            } else if (responseText[i] === '}') {
              braceCount--;
              if (braceCount === 0 && startIndex !== -1) {
                endIndex = i;
                break;
              }
            }
          }

          if (startIndex !== -1 && endIndex !== -1) {
            jsonText = responseText.substring(startIndex, endIndex + 1);
            parsedContent = JSON.parse(jsonText);
          } else {
            throw new Error('未找到有效的JSON对象');
          }
        }
      }

      logger.info('✅ JSON解析成功');
    } catch (parseError) {
      logger.warn('⚠️  JSON解析失败，使用文本解析:', parseError.message);

      // 检查是否包含JSON关键字，如果是则说明格式有问题
      if (responseText.includes('"title"') || responseText.includes('"content"')) {
        logger.error('❌ 响应包含JSON关键字但解析失败，可能是格式错误');
        logger.error('原始响应:', responseText.substring(0, 200));
      }

      // 文本解析：按行分割，过滤掉JSON语法字符
      const lines = responseText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.match(/^[{}\[\],]$/)); // 过滤掉纯JSON语法行

      // 如果第一行看起来像JSON，跳过它
      let titleLine = lines[0] || '精选推荐';
      if (titleLine.startsWith('{') || titleLine.startsWith('"')) {
        titleLine = lines[1] || '精选推荐';
      }

      parsedContent = {
        title: titleLine.substring(0, 20),
        content: lines.slice(1).join('\n') || responseText,
        tags: []
      };
    }

    // 5. 清理Markdown格式
    parsedContent.title = cleanMarkdownFormat(parsedContent.title);
    parsedContent.content = cleanMarkdownFormat(parsedContent.content);

    // 6. 应用反AIGC策略
    let aigcApplied = [];
    if (enableAntiAIGC) {
      logger.info('🎨 应用反AIGC策略...');
      const antiAigcResult = antiAigcStrategies.applyAntiAIGCStrategies(
        parsedContent.content,
        { wordVariationRate: 0.5, injectFillers: true, removeTemplateWords: true }
      );
      parsedContent.content = antiAigcResult.text;
      aigcApplied = antiAigcResult.applied;
    }

    // 7. 敏感词过滤
    let sensitiveWordsFound = [];
    if (enableSensitiveFilter) {
      logger.info('🛡️ 检测敏感词...');
      const titleFilter = sensitiveWordService.filter(parsedContent.title, true);
      parsedContent.title = titleFilter.text;
      sensitiveWordsFound.push(...titleFilter.found);

      const contentFilter = sensitiveWordService.filter(parsedContent.content, true);
      parsedContent.content = contentFilter.text;
      sensitiveWordsFound.push(...contentFilter.found);

      if (Array.isArray(parsedContent.tags)) {
        parsedContent.tags = parsedContent.tags.map(tag => {
          const tagFilter = sensitiveWordService.filter(tag, true);
          sensitiveWordsFound.push(...tagFilter.found);
          return tagFilter.text;
        });
      }
    }

    // 8. 截断标题和内容
    parsedContent.title = truncateTitle(parsedContent.title, 20);

    // 截断正文到1000字，保持句子完整性
    if (parsedContent.content.length > 1000) {
      parsedContent.content = parsedContent.content.substring(0, 1000);
      // 尝试在句号处截断
      const lastPeriod = parsedContent.content.lastIndexOf('。');
      if (lastPeriod > 800) {
        parsedContent.content = parsedContent.content.substring(0, lastPeriod + 1);
      }
    }

    // 9. 评估AIGC特征
    const aigcEvaluation = antiAigcStrategies.evaluateAIGCFeatures(parsedContent.content);
    logger.info('📊 AIGC评分:', aigcEvaluation.score, '/100');

    // 10. 准备元数据
    const metadata = {
      version: version,
      aigc_score: aigcEvaluation.score,
      aigc_applied: aigcApplied,
      sensitive_words_found: sensitiveWordsFound.map(w => ({
        word: w.word,
        category: w.category,
        replacement: w.replacement
      })),
      word_count: parsedContent.content.length
    };

    // Phase 2: 如果使用了热门笔记，添加到元数据
    if (hotPosts && hotPosts.length > 0) {
      metadata.hot_posts_used = hotPosts.slice(0, 5).map(post => ({
        title: post.title,
        likes: post.interact_info?.liked_count || 0
      }));
      logger.info(`✅ 使用了 ${metadata.hot_posts_used.length} 篇热门笔记作为参考`);
    }

    return {
      success: true,
      data: {
        title: parsedContent.title,
        content: parsedContent.content,
        tags: Array.isArray(parsedContent.tags) ? parsedContent.tags : []
      },
      provider: result.provider,
      model: result.model,
      cost: result.cost,
      metadata: metadata
    };
  } catch (error) {
    logger.error('❌ AI生成文案失败（v2.2）:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 双重专家系统生成（Phase 2）
 * 分析专家 + 创作专家
 */
export async function generateWithDualExpertSystem(params) {
  const {
    productInfo, knowledgeBase,
    style = '种草型', targetAudience = '大众',
    model = 'deepseek-chat', post_id = null,
    keyword = null,
    wordCount = 800  // 目标字数
  } = params;

  logger.info('🎯 开始双重专家系统生成');

  try {
    // 导入服务（动态导入避免循环依赖）
    const xhsScraperService = (await import('./xhsScraperService.js')).default;
    const cacheService = (await import('./cacheService.js')).default;

    // 确定关键词
    const searchKeyword = keyword || productInfo.category || productInfo.name;
    logger.info(`🔍 分析关键词: ${searchKeyword}`);

    // 阶段1: 分析专家 - 获取并分析热门笔记
    let hotPostsData;
    let analysisResult;

    // 1.1 尝试从缓存获取
    const cached = await cacheService.get(searchKeyword);
    if (cached && cached.processedNotes) {
      logger.info('✅ 使用缓存的热门笔记数据');
      hotPostsData = xhsScraperService.formatNotesAsText(searchKeyword, cached.processedNotes);
    } else {
      // 1.2 抓取新数据
      try {
        logger.info('🌐 开始抓取热门笔记...');
        const notes = await xhsScraperService.scrapeHotPosts(searchKeyword);
        hotPostsData = xhsScraperService.formatNotesAsText(searchKeyword, notes);

        // 保存到缓存
        await cacheService.save(searchKeyword, hotPostsData, notes, 'scraped');
      } catch (scrapeError) {
        logger.warn('⚠️ 抓取失败，尝试使用备用缓存:', scrapeError.message);

        // 1.3 使用备用缓存
        const fallback = await cacheService.getFallback(searchKeyword);
        if (fallback) {
          hotPostsData = fallback.data;
        } else {
          throw new Error('无法获取热门笔记数据，且无可用缓存');
        }
      }
    }

    // 1.4 调用AI分析热门笔记
    logger.info('🧠 分析专家：分析热门笔记...');
    const analysisPrompt = promptTemplates.getAnalysisPrompt(hotPostsData);

    const analysisResponse = await callAIAPIWithFallback(
      model,
      [{ role: 'user', content: analysisPrompt }],
      4000,
      { post_id, operation: 'analyze' }
    );

    // 解析分析结果
    let responseText = analysisResponse.content;
    if (Array.isArray(responseText) && responseText[0]?.text) {
      responseText = responseText[0].text;
    }

    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    try {
      // 尝试多种JSON提取方式
      try {
        analysisResult = JSON.parse(responseText);
        logger.info('✅ 分析完成');
      } catch (e) {
        // 使用非贪婪匹配提取JSON对象
        const jsonMatch = responseText.match(/\{[\s\S]*?\}(?=\s*$|\s*\n\s*[^}\s])/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
          logger.info('✅ 分析完成（正则提取）');
        } else {
          // 查找第一个完整的JSON对象
          let braceCount = 0;
          let startIndex = -1;
          let endIndex = -1;

          for (let i = 0; i < responseText.length; i++) {
            if (responseText[i] === '{') {
              if (braceCount === 0) startIndex = i;
              braceCount++;
            } else if (responseText[i] === '}') {
              braceCount--;
              if (braceCount === 0 && startIndex !== -1) {
                endIndex = i;
                break;
              }
            }
          }

          if (startIndex !== -1 && endIndex !== -1) {
            const jsonText = responseText.substring(startIndex, endIndex + 1);
            analysisResult = JSON.parse(jsonText);
            logger.info('✅ 分析完成（括号匹配）');
          } else {
            throw new Error('未找到有效的JSON');
          }
        }
      }
    } catch (parseError) {
      logger.warn('⚠️ 分析结果解析失败，使用默认结构');
      analysisResult = {
        titleFormulas: { suggestedFormulas: [], commonKeywords: [] },
        contentStructure: { openingHooks: [], bodyTemplate: '' },
        tagStrategy: { commonTags: [] }
      };
    }

    // 阶段2: 创作专家 - 基于分析结果生成内容
    logger.info('✍️ 创作专家：生成内容...');

    // 构建增强的Prompt（包含分析结果）
    const enhancedPrompt = promptTemplates.getAdvancedGenerationPrompt(
      productInfo,
      knowledgeBase + '\n\n【爆款规律参考】\n' + JSON.stringify(analysisResult, null, 2),
      style,
      targetAudience,
      null,  // hotPosts
      wordCount
    );

    const contentResponse = await callAIAPIWithFallback(
      model,
      [{ role: 'user', content: enhancedPrompt }],
      2048,
      { post_id, operation: 'generate' }
    );

    // 解析生成内容
    let contentText = contentResponse.content;
    if (Array.isArray(contentText) && contentText[0]?.text) {
      contentText = contentText[0].text;
    }

    contentText = contentText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    contentText = contentText.replace(/"/g, '"').replace(/"/g, '"');

    let parsedContent;
    try {
      // 尝试多种JSON提取方式
      try {
        parsedContent = JSON.parse(contentText);
      } catch (e) {
        // 使用非贪婪匹配提取JSON对象
        const jsonMatch = contentText.match(/\{[\s\S]*?\}(?=\s*$|\s*\n\s*[^}\s])/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          // 查找第一个完整的JSON对象
          let braceCount = 0;
          let startIndex = -1;
          let endIndex = -1;

          for (let i = 0; i < contentText.length; i++) {
            if (contentText[i] === '{') {
              if (braceCount === 0) startIndex = i;
              braceCount++;
            } else if (contentText[i] === '}') {
              braceCount--;
              if (braceCount === 0 && startIndex !== -1) {
                endIndex = i;
                break;
              }
            }
          }

          if (startIndex !== -1 && endIndex !== -1) {
            const jsonText = contentText.substring(startIndex, endIndex + 1);
            parsedContent = JSON.parse(jsonText);
          } else {
            throw new Error('未找到有效的JSON');
          }
        }
      }

      logger.info('✅ 内容JSON解析成功');
    } catch (parseError) {
      logger.warn('⚠️ 内容JSON解析失败，使用文本解析:', parseError.message);

      // 检查是否包含JSON关键字
      if (contentText.includes('"title"') || contentText.includes('"content"')) {
        logger.error('❌ 响应包含JSON关键字但解析失败');
        logger.error('原始响应:', contentText.substring(0, 200));
      }

      // 文本解析：过滤掉JSON语法字符
      const lines = contentText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.match(/^[{}\[\],]$/));

      // 如果第一行看起来像JSON，跳过它
      let titleLine = lines[0] || '精选推荐';
      if (titleLine.startsWith('{') || titleLine.startsWith('"')) {
        titleLine = lines[1] || '精选推荐';
      }

      parsedContent = {
        title: titleLine.substring(0, 20),
        content: lines.slice(1).join('\n') || contentText,
        tags: []
      };
    }

    // 应用Phase 1的优化（清理、反AIGC、敏感词过滤）
    parsedContent.title = cleanMarkdownFormat(parsedContent.title);
    parsedContent.content = cleanMarkdownFormat(parsedContent.content);

    // 反AIGC策略
    const antiAigcResult = antiAigcStrategies.applyAntiAIGCStrategies(
      parsedContent.content,
      { wordVariationRate: 0.5, injectFillers: true, removeTemplateWords: true }
    );
    parsedContent.content = antiAigcResult.text;

    // 敏感词过滤
    const titleFilter = sensitiveWordService.filter(parsedContent.title, true);
    parsedContent.title = titleFilter.text;

    const contentFilter = sensitiveWordService.filter(parsedContent.content, true);
    parsedContent.content = contentFilter.text;

    const sensitiveWordsFound = [...titleFilter.found, ...contentFilter.found];

    // 截断
    parsedContent.title = truncateTitle(parsedContent.title, 20);
    if (parsedContent.content.length > 1000) {
      parsedContent.content = parsedContent.content.substring(0, 1000);
      const lastPeriod = parsedContent.content.lastIndexOf('。');
      if (lastPeriod > 800) {
        parsedContent.content = parsedContent.content.substring(0, lastPeriod + 1);
      }
    }

    // 评估AIGC特征
    const aigcEvaluation = antiAigcStrategies.evaluateAIGCFeatures(parsedContent.content);

    logger.info('🎉 双重专家系统生成完成');
    logger.info(`📊 AIGC评分: ${aigcEvaluation.score}/100`);

    return {
      success: true,
      data: {
        title: parsedContent.title,
        content: parsedContent.content,
        tags: Array.isArray(parsedContent.tags) ? parsedContent.tags : []
      },
      provider: contentResponse.provider,
      model: contentResponse.model,
      cost: (analysisResponse.cost || 0) + (contentResponse.cost || 0),
      metadata: {
        version: 'v2.2-dual',
        mode: 'dual-expert',
        keyword: searchKeyword,
        analysis_result: analysisResult,
        aigc_score: aigcEvaluation.score,
        aigc_applied: antiAigcResult.applied,
        sensitive_words_found: sensitiveWordsFound.map(w => ({
          word: w.word,
          category: w.category,
          replacement: w.replacement
        })),
        word_count: parsedContent.content.length
      }
    };
  } catch (error) {
    logger.error('❌ 双重专家系统生成失败:', error);
    return { success: false, error: error.message };
  }
}
