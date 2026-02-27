/**
 * 语法检查服务
 * 三层检查策略：规则检查 + AI检查 + 统计检查
 */

import logger from '../utils/logger.js';
import { callAIAPIWithFallback } from './aiService.js';

/**
 * 常见语法错误规则
 */
const GRAMMAR_RULES = [
  // 重复词检查
  {
    name: '重复词',
    pattern: /(\S{2,})\1+/g,
    severity: 'warning',
    message: '检测到重复词：{match}'
  },

  // 标点符号错误
  {
    name: '连续标点',
    pattern: /[，。！？；：、]{2,}/g,
    severity: 'error',
    message: '连续标点符号：{match}'
  },

  // 空格使用不当
  {
    name: '中文间多余空格',
    pattern: /[\u4e00-\u9fa5]\s+[\u4e00-\u9fa5]/g,
    severity: 'warning',
    message: '中文字符间不应有空格'
  },

  // 英文标点在中文中
  {
    name: '中英文标点混用',
    pattern: /[\u4e00-\u9fa5][,;:!?][\u4e00-\u9fa5]/g,
    severity: 'warning',
    message: '中文中应使用中文标点'
  },

  // 的地得误用（简单规则）
  {
    name: '的地得误用',
    pattern: /(很|非常|特别|十分)(地|得)[\u4e00-\u9fa5]{1,3}/g,
    severity: 'warning',
    message: '副词后应使用"地"'
  }
];

/**
 * 统计检查规则
 */
function statisticalCheck(text) {
  const issues = [];

  // 检查句子长度（过长的句子可能有问题）
  const sentences = text.split(/[。！？]/);
  sentences.forEach((sentence, index) => {
    if (sentence.length > 100) {
      issues.push({
        type: 'statistical',
        severity: 'info',
        message: `句子过长（${sentence.length}字），建议拆分`,
        position: text.indexOf(sentence),
        length: sentence.length
      });
    }
  });

  // 检查重复短语
  const phrases = text.match(/[\u4e00-\u9fa5]{3,}/g) || [];
  const phraseCount = {};
  phrases.forEach(phrase => {
    phraseCount[phrase] = (phraseCount[phrase] || 0) + 1;
  });

  Object.entries(phraseCount).forEach(([phrase, count]) => {
    if (count > 2) {
      issues.push({
        type: 'statistical',
        severity: 'info',
        message: `短语"${phrase}"重复${count}次`,
        suggestion: '考虑使用同义词替换'
      });
    }
  });

  return issues;
}

/**
 * 规则检查
 */
function ruleBasedCheck(text) {
  const issues = [];

  GRAMMAR_RULES.forEach(rule => {
    const matches = text.matchAll(rule.pattern);
    for (const match of matches) {
      issues.push({
        type: 'rule',
        name: rule.name,
        severity: rule.severity,
        message: rule.message.replace('{match}', match[0]),
        position: match.index,
        length: match[0].length,
        original: match[0]
      });
    }
  });

  return issues;
}

/**
 * AI语法检查
 */
async function aiGrammarCheck(text, model = 'deepseek-chat') {
  const prompt = `# Role: 中文语法专家

## Task
检查以下文本的语法错误、病句、表达不当等问题。

## Text
${text}

## Requirements
1. 识别语法错误（主谓不一致、成分残缺、搭配不当等）
2. 识别病句（歧义句、重复啰嗦、逻辑混乱等）
3. 识别表达不当（用词不准确、语序不当等）
4. 对每个问题提供修改建议

## Output Format
返回JSON数组，每个问题包含：
{
  "type": "语法错误|病句|表达不当",
  "severity": "error|warning|info",
  "message": "问题描述",
  "original": "原文",
  "suggestion": "修改建议",
  "position": 大致位置（可选）
}

如果没有问题，返回空数组 []

只返回JSON，不要其他文字。`;

  try {
    const result = await callAIAPIWithFallback(
      model,
      [{ role: 'user', content: prompt }],
      2048,
      { operation: 'grammar_check' }
    );

    let responseText = result.content;
    if (Array.isArray(responseText) && responseText[0]?.text) {
      responseText = responseText[0].text;
    }

    // 清理响应
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // 解析JSON
    const aiIssues = JSON.parse(responseText);
    return Array.isArray(aiIssues) ? aiIssues : [];
  } catch (error) {
    logger.error('AI语法检查失败:', error);
    return [];
  }
}

/**
 * 综合语法检查
 */
export async function checkGrammar(text, options = {}) {
  const {
    enableRuleCheck = true,
    enableStatisticalCheck = true,
    enableAICheck = true,
    model = 'deepseek-chat'
  } = options;

  logger.info('🔍 开始语法检查...');

  const results = {
    success: true,
    issues: [],
    summary: {
      total: 0,
      error: 0,
      warning: 0,
      info: 0
    }
  };

  try {
    // 1. 规则检查
    if (enableRuleCheck) {
      logger.info('📋 规则检查...');
      const ruleIssues = ruleBasedCheck(text);
      results.issues.push(...ruleIssues);
    }

    // 2. 统计检查
    if (enableStatisticalCheck) {
      logger.info('📊 统计检查...');
      const statIssues = statisticalCheck(text);
      results.issues.push(...statIssues);
    }

    // 3. AI检查
    if (enableAICheck) {
      logger.info('🤖 AI检查...');
      const aiIssues = await aiGrammarCheck(text, model);
      results.issues.push(...aiIssues.map(issue => ({
        ...issue,
        type: 'ai'
      })));
    }

    // 统计问题数量
    results.issues.forEach(issue => {
      results.summary.total++;
      results.summary[issue.severity]++;
    });

    logger.info(`✅ 语法检查完成，发现 ${results.summary.total} 个问题`);

    return results;
  } catch (error) {
    logger.error('❌ 语法检查失败:', error);
    return {
      success: false,
      error: error.message,
      issues: []
    };
  }
}

/**
 * 快速检查（仅规则+统计，不使用AI）
 */
export async function quickCheck(text) {
  return checkGrammar(text, {
    enableRuleCheck: true,
    enableStatisticalCheck: true,
    enableAICheck: false
  });
}

export default {
  checkGrammar,
  quickCheck
};
