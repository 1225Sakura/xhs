/**
 * 敏感词过滤服务
 * 用于检测和过滤可能违反平台规则的敏感词汇
 *
 * 功能：
 * - 检测文本中的敏感词
 * - 自动替换敏感词为合规词汇
 * - 支持流式过滤
 * - 提供详细的检测报告
 */

/**
 * 敏感词库 - 根据小红书等平台的内容规范整理
 * 共105+个敏感词，分为8大类
 */
const SENSITIVE_WORDS = [
  // 1. 绝对化词语 - 广告法禁用词
  '最', '第一', '首个', '首选', '顶级', '极致', '终极', '完美',
  '绝对', '唯一', '独一无二', '史上最', '全网最', '世界级', '国家级',
  '顶尖', '至尊', '极品', '王牌', '冠军', '领先', '领导品牌',

  // 2. 医疗/功效承诺词语
  '治疗', '疗效', '治愈', '根治', '痊愈', '康复', '医治',
  '修复基因', '抗炎', '消炎', '祛疤', '再生', '重生',
  '药用', '医用', '临床', '处方', '药物', '医学',
  '病理', '症状', '诊断', '手术', '医院专用',

  // 3. 夸大宣传词语
  '秒杀', '彻底', '立竿见影', '一天见效', '三天见效', '一周见效',
  '100%有效', '100%成功', '保证', '承诺', '签约', '无效退款',
  '神奇', '奇迹', '魔法', '革命性', '颠覆性', '突破性',
  '前所未有', '史无前例', '空前绝后',

  // 4. 其他平台引流词
  '微信', 'vx', 'v信', 'VX', 'V信', 'weixin', 'wechat',
  '加我', '私聊', '私信', '联系我', '扫码', '二维码',
  'QQ', 'qq', '企鹅', '扣扣', '电话', '手机号',

  // 5. 低俗/不当词汇
  '性感', '诱惑', '挑逗', '撩人', '勾引', '暧昧',

  // 6. 违法违规词汇
  '赌博', '博彩', '彩票', '六合彩', '赌场', '老虎机',
  '高利贷', '套现', '洗钱', '传销', '直销', '拉人头',
  '刷单', '刷量', '刷粉', '买粉', '僵尸粉',

  // 7. 政治敏感词汇
  '政府', '官方', '国务院', '中央', '领导人',

  // 8. 迷信/封建词汇
  '算命', '占卜', '风水', '看相', '测字', '求签',
  '转运', '开光', '消灾', '辟邪', '招财', '旺运'
];

/**
 * 敏感词替换映射 - 提供更温和的替代词
 */
const WORD_REPLACEMENTS = {
  // 绝对化词语替换
  '最': '很',
  '第一': '优秀',
  '首个': '早期',
  '首选': '推荐',
  '顶级': '高品质',
  '极致': '出色',
  '终极': '高级',
  '完美': '优秀',
  '绝对': '非常',
  '唯一': '独特',
  '独一无二': '与众不同',
  '史上最': '非常',
  '全网最': '很受欢迎',
  '世界级': '高水平',
  '国家级': '专业',
  '顶尖': '优秀',
  '至尊': '高级',
  '极品': '精品',
  '王牌': '优质',
  '冠军': '优秀',
  '领先': '先进',
  '领导品牌': '知名品牌',

  // 医疗词语替换
  '治疗': '改善',
  '疗效': '效果',
  '治愈': '改善',
  '根治': '改善',
  '痊愈': '恢复',
  '康复': '恢复',
  '医治': '改善',
  '修复基因': '改善',
  '抗炎': '舒缓',
  '消炎': '舒缓',
  '祛疤': '淡化',
  '再生': '改善',
  '重生': '焕新',
  '药用': '专用',
  '医用': '专用',
  '临床': '专业',
  '处方': '配方',
  '药物': '产品',
  '医学': '专业',
  '病理': '问题',
  '症状': '现象',
  '诊断': '判断',
  '手术': '处理',
  '医院专用': '专业级',

  // 夸大宣传替换
  '秒杀': '优惠',
  '彻底': '有效',
  '立竿见影': '见效快',
  '一天见效': '见效快',
  '三天见效': '见效快',
  '一周见效': '逐渐见效',
  '100%有效': '很有效',
  '100%成功': '效果好',
  '保证': '期待',
  '承诺': '期待',
  '签约': '合作',
  '无效退款': '品质保障',
  '神奇': '不错',
  '奇迹': '惊喜',
  '魔法': '神奇',
  '革命性': '创新',
  '颠覆性': '创新',
  '突破性': '创新',
  '前所未有': '创新',
  '史无前例': '罕见',
  '空前绝后': '独特',

  // 其他替换
  '性感': '优雅',
  '诱惑': '吸引',
  '挑逗': '有趣',
  '撩人': '迷人',
  '勾引': '吸引',
  '暧昧': '微妙'
};

class SensitiveWordService {
  constructor() {
    this.sensitiveWords = SENSITIVE_WORDS;
    this.replacements = WORD_REPLACEMENTS;
    this.regex = this.createRegex();
  }

  /**
   * 创建敏感词正则表达式
   * 按长度排序，优先匹配长词汇
   */
  createRegex() {
    // 按长度排序，优先匹配长词汇（避免"100%有效"被拆分成"100%"和"有效"）
    const sortedWords = [...this.sensitiveWords].sort((a, b) => b.length - a.length);

    // 转义特殊字符并创建正则表达式
    const escapedWords = sortedWords.map(word =>
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    return new RegExp(escapedWords.join('|'), 'gi');
  }

  /**
   * 检测文本中的敏感词
   * @param {string} text - 待检测的文本
   * @returns {Array} 检测到的敏感词列表
   */
  detect(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const found = [];
    const matches = text.matchAll(this.regex);

    for (const match of matches) {
      const word = match[0];
      found.push({
        word: word,
        position: match.index,
        replacement: this.replacements[word] || this.replacements[word.toLowerCase()] || '',
        category: this.getCategoryByWord(word)
      });
    }

    return found;
  }

  /**
   * 过滤文本中的敏感词
   * @param {string} text - 待过滤的文本
   * @param {boolean} autoReplace - 是否自动替换（默认true）
   * @returns {Object} { text: 过滤后的文本, found: 发现的敏感词列表 }
   */
  filter(text, autoReplace = true) {
    if (!text || typeof text !== 'string') {
      return { text: text || '', found: [] };
    }

    const found = this.detect(text);

    if (!autoReplace || found.length === 0) {
      return { text, found };
    }

    let filtered = text;

    // 按位置倒序替换，避免位置偏移
    const sortedFound = [...found].sort((a, b) => b.position - a.position);

    for (const item of sortedFound) {
      if (item.replacement) {
        const before = filtered.substring(0, item.position);
        const after = filtered.substring(item.position + item.word.length);
        filtered = before + item.replacement + after;
      }
    }

    return { text: filtered, found };
  }

  /**
   * 流式过滤（用于实时过滤生成的内容）
   * @param {string} chunk - 文本片段
   * @param {Object} context - 上下文（用于跨片段匹配）
   * @returns {Object} { chunk: 过滤后的片段, found: 发现的敏感词, context: 更新后的上下文 }
   */
  filterStream(chunk, context = {}) {
    // 将当前片段与上下文缓冲区合并
    const buffer = (context.buffer || '') + chunk;

    // 检测敏感词
    const result = this.filter(buffer, true);

    // 计算已处理的长度（保留最后N个字符作为缓冲，防止跨片段的敏感词被遗漏）
    const bufferSize = Math.max(...this.sensitiveWords.map(w => w.length));
    const processedLength = Math.max(0, result.text.length - bufferSize);

    return {
      chunk: result.text.substring(context.processedLength || 0, processedLength),
      found: result.found,
      context: {
        buffer: result.text.substring(processedLength),
        processedLength: processedLength
      }
    };
  }

  /**
   * 获取敏感词所属类别
   * @param {string} word - 敏感词
   * @returns {string} 类别名称
   */
  getCategoryByWord(word) {
    const categories = {
      '绝对化词语': ['最', '第一', '首个', '首选', '顶级', '极致', '终极', '完美', '绝对', '唯一', '独一无二', '史上最', '全网最', '世界级', '国家级', '顶尖', '至尊', '极品', '王牌', '冠军', '领先', '领导品牌'],
      '医疗术语': ['治疗', '疗效', '治愈', '根治', '痊愈', '康复', '医治', '修复基因', '抗炎', '消炎', '祛疤', '再生', '重生', '药用', '医用', '临床', '处方', '药物', '医学', '病理', '症状', '诊断', '手术', '医院专用'],
      '夸大宣传': ['秒杀', '彻底', '立竿见影', '一天见效', '三天见效', '一周见效', '100%有效', '100%成功', '保证', '承诺', '签约', '无效退款', '神奇', '奇迹', '魔法', '革命性', '颠覆性', '突破性', '前所未有', '史无前例', '空前绝后'],
      '引流词汇': ['微信', 'vx', 'v信', 'VX', 'V信', 'weixin', 'wechat', '加我', '私聊', '私信', '联系我', '扫码', '二维码', 'QQ', 'qq', '企鹅', '扣扣', '电话', '手机号'],
      '不当词汇': ['性感', '诱惑', '挑逗', '撩人', '勾引', '暧昧'],
      '违规词汇': ['赌博', '博彩', '彩票', '六合彩', '赌场', '老虎机', '高利贷', '套现', '洗钱', '传销', '直销', '拉人头', '刷单', '刷量', '刷粉', '买粉', '僵尸粉'],
      '政治敏感': ['政府', '官方', '国务院', '中央', '领导人'],
      '迷信词汇': ['算命', '占卜', '风水', '看相', '测字', '求签', '转运', '开光', '消灾', '辟邪', '招财', '旺运']
    };

    for (const [category, words] of Object.entries(categories)) {
      if (words.includes(word) || words.includes(word.toLowerCase())) {
        return category;
      }
    }

    return '其他';
  }

  /**
   * 获取统计信息
   * @param {string} text - 文本
   * @returns {Object} 统计信息
   */
  getStatistics(text) {
    const found = this.detect(text);
    const categories = {};

    for (const item of found) {
      const category = item.category;
      if (!categories[category]) {
        categories[category] = {
          count: 0,
          words: []
        };
      }
      categories[category].count++;
      if (!categories[category].words.includes(item.word)) {
        categories[category].words.push(item.word);
      }
    }

    return {
      total: found.length,
      unique: new Set(found.map(f => f.word)).size,
      categories: categories,
      hasReplacement: found.filter(f => f.replacement).length,
      noReplacement: found.filter(f => !f.replacement).length
    };
  }
}

// 导出单例
export default new SensitiveWordService();
