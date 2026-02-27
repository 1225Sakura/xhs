/**
 * 反AIGC检测策略工具
 *
 * 目标：降低AI生成内容的检测率至<10%
 *
 * 策略：
 * 1. 词汇多样性 - 同义词替换库
 * 2. 句式随机化 - 避免固定模式
 * 3. 口语化辅助词 - 增加自然度
 * 4. 动词短语扩展 - 避免过于简洁
 * 5. 不完美表达 - 模拟真人写作特征
 *
 * 参考：xhs-ai-writer v2.2 反AIGC策略
 */

/**
 * 词汇多样性替换库
 * 同一概念使用不同表达，避免重复
 */
const WORD_VARIATIONS = {
  // 动词类 - 短语扩展策略
  "用": ["开始用", "去用", "试着用", "用起来", "用上了"],
  "买": ["入手了", "拿下了", "剁手买了", "下单买了", "买到手"],
  "做": ["去做", "开始做", "做起来", "着手做"],
  "看": ["去看", "看了看", "瞅了瞅", "观察了下"],
  "试": ["试了试", "尝试了下", "试用了", "体验了"],

  // 动词 - 带过程描述的扩展
  "使用": ["用", "试试", "上手", "整上", "搞个", "弄个", "开始使用", "用起来"],
  "感觉": ["觉得", "感受是", "给我的感觉", "我的体验", "个人感觉", "感受下来"],
  "推荐": ["安利", "墙裂推荐", "真的建议", "可以试试", "不妨考虑", "值得入手", "真心推荐"],
  "发现": ["注意到", "意外发现", "后来才知道", "直到...才发现", "才意识到", "发觉"],
  "非常": ["超", "特别", "贼", "真的很", "不是一般的", "相当", "格外"],
  "喜欢": ["爱了", "好喜欢", "心动", "种草", "真香", "中意", "真的爱"],
  "满意": ["满足", "达到预期", "没让我失望", "超出期待", "还不错", "挺满意"],
  "购买": ["入手", "拿下", "买了", "剁手", "下单", "入了"],
  "效果": ["成果", "表现", "实际感受", "用下来的感觉", "效果呈现"],
  "便宜": ["划算", "性价比高", "不贵", "价格友好", "亲民", "实惠"],

  // 连接词类 - 系统性替换
  "但是": ["不过", "可是", "话说回来", "只是", "倒是", "就是", "然而"],
  "因为": ["毕竟", "主要是", "这是因为", "原因在于", "要说为啥", "由于"],
  "所以": ["于是", "这样一来", "结果", "那么", "就这样", "因此"],
  "而且": ["还有", "另外", "再说", "加上", "更别说", "并且"],
  "如果": ["要是", "假如", "万一", "倘若", "假使"],
  "虽然": ["尽管", "即使", "就算", "纵然"],
  "然后": ["接着", "后来", "再说", "之后", "紧接着", "随后"],

  // 介词类 - 系统性替换
  "通过": ["借助", "依靠", "凭借", "靠着", "用"],
  "对于": ["关于", "说到", "提到", "讲到"],
  "关于": ["说到", "提到", "至于", "讲起"],
  "在": ["于", "处在", "位于", "当"],
  "和": ["跟", "同", "与", "以及"],
  "与": ["和", "跟", "同", "以及"],

  // 程度副词类 - 增加表达层次
  "很": ["挺", "蛮", "还挺", "比较", "相对", "算是", "颇为"],
  "太": ["过于", "实在", "确实", "着实", "相当"],
  "特别": ["格外", "尤其", "分外", "十分"],

  // 时间词类 - 避免整数时间
  "一周": ["七天", "一个礼拜", "大概一周", "差不多一周", "一周时间"],
  "一个月": ["30天", "一个月左右", "大概一个月", "快一个月了", "一月左右"],
  "一天": ["24小时", "一整天", "一天时间", "一天下来"]
};

/**
 * 口语化辅助词库
 * 增加句子饱满度和自然度
 */
const COLLOQUIAL_FILLERS = {
  // 确认/强调类
  "确认词": ["真的", "确实", "的确", "实在", "说实话", "老实说"],
  // 意外/惊讶类
  "惊讶词": ["居然", "竟然", "简直", "没想到", "意外地"],
  // 程度/评估类
  "评估词": ["算是", "应该", "大概", "差不多", "基本上", "几乎"],
  // 转折/补充类
  "转折词": ["其实", "反而", "倒是", "反正", "至少"],
  // 时态/状态类
  "状态词": ["已经", "还", "也", "又", "就", "才", "都"]
};

/**
 * 条件句式转换模板
 * 书面语转口语
 */
const CONDITIONAL_PATTERNS = [
  { from: "若...则...", to: "要是...那就..." },
  { from: "如果...便...", to: "假如...就..." },
  { from: "倘若...即...", to: "万一...就..." },
  { from: "由于...因此...", to: "因为...所以..." },
  { from: "鉴于...故...", to: "既然...那..." },
  { from: "虽然...但是...", to: "尽管...不过..." },
  { from: "即便...也...", to: "就算...也..." }
];

/**
 * 句式起始词库
 * 增加开头多样性
 */
const SENTENCE_STARTERS = [
  "说实话", "不得不说", "讲真", "老实讲", "怎么说呢",
  "你别说", "我发现", "有件事", "关于这个", "提到这个",
  "印象最深的是", "让我惊喜的是", "没想到", "意外的是",
  "跟你们说", "必须说", "真心话", "坦白讲", "实话实说"
];

/**
 * 情绪转折词库
 * 制造自然的情绪波动
 */
const EMOTIONAL_TRANSITIONS = [
  "本来还担心...结果发现完全多虑了",
  "刚开始有点犹豫...但后来觉得真香",
  "一开始不太确定...用了之后打脸了",
  "以为会很好...用了后觉得一般...但坚持几天后...哇塞",
  "期待很高...刚开始有点失望...后来发现是我用错了",
  "刚开始我是拒绝的...但架不住朋友一直夸...试了后...真香",
  "说实话我一开始不信...直到自己试了"
];

/**
 * 不完美表达库
 * 模拟真人写作的停顿和修正
 */
const IMPERFECT_EXPRESSIONS = [
  "就是...那种感觉",
  "怎么说呢...就是很舒服",
  "好像是...应该没错",
  "差不多就是这样",
  "大概...嗯...对的",
  "效果嘛...你们懂的"
];

/**
 * 去AI味口头禅池
 */
const COLLOQUIALISMS_POOL = [
  "说真的", "别笑我哈", "我人都傻了", "绝了", "真的会谢",
  "笑死", "救命", "我真的会哭", "家人们谁懂啊", "太香了",
  "谁懂这种快乐", "我真的栓Q", "太离谱了",
  "我直接好家伙", "我直呼好家伙"
];

/**
 * AI模板词黑名单
 * 这些词是AI的典型特征，必须完全避免
 */
const AI_TEMPLATE_BLACKLIST = [
  "首先", "其次", "再次", "然后", "接着", "最后", "总之", "综上所述",
  "值得一提的是", "值得注意的是", "需要注意的是", "总的来说",
  "盘点", "闭眼入", "yyds", "种草机", "X大要点",
  "以上", "正文如下", "以下是", "具体来说", "具体而言"
];

/**
 * 应用词汇多样性替换
 * @param {string} text - 原始文本
 * @param {number} replaceRate - 替换率（0-1），默认0.5
 * @returns {string} 替换后的文本
 */
function applyWordVariations(text, replaceRate = 0.5) {
  let result = text;

  for (const [original, variations] of Object.entries(WORD_VARIATIONS)) {
    // 创建正则表达式，匹配完整词汇
    const regex = new RegExp(original, 'g');
    const matches = [...text.matchAll(regex)];

    if (matches.length > 0) {
      // 随机替换部分匹配项
      let replacedCount = 0;
      result = result.replace(regex, (match) => {
        // 根据替换率决定是否替换
        if (Math.random() < replaceRate && replacedCount < matches.length) {
          replacedCount++;
          // 随机选择一个变体
          const replacement = variations[Math.floor(Math.random() * variations.length)];
          return replacement;
        }
        return match;
      });
    }
  }

  return result;
}

/**
 * 注入口语化辅助词
 * @param {string} text - 原始文本
 * @returns {string} 注入后的文本
 */
function injectColloquialFillers(text) {
  // 将文本分割成句子
  const sentences = text.split(/([。！？\n])/);
  const result = [];

  for (let i = 0; i < sentences.length; i++) {
    let sentence = sentences[i];

    // 跳过标点符号
    if (/^[。！？\n]$/.test(sentence)) {
      result.push(sentence);
      continue;
    }

    // 随机决定是否注入辅助词（30%概率）
    if (Math.random() < 0.3 && sentence.length > 10) {
      // 随机选择一个类别
      const categories = Object.keys(COLLOQUIAL_FILLERS);
      const category = categories[Math.floor(Math.random() * categories.length)];
      const fillers = COLLOQUIAL_FILLERS[category];
      const filler = fillers[Math.floor(Math.random() * fillers.length)];

      // 随机决定注入位置（开头或中间）
      if (Math.random() < 0.5) {
        // 注入到开头
        sentence = filler + sentence;
      } else {
        // 注入到中间（在逗号后）
        const commaIndex = sentence.indexOf('，');
        if (commaIndex > 0) {
          sentence = sentence.substring(0, commaIndex + 1) + filler + sentence.substring(commaIndex + 1);
        }
      }
    }

    result.push(sentence);
  }

  return result.join('');
}

/**
 * 检测AI模板词
 * @param {string} text - 文本
 * @returns {Array} 发现的AI模板词列表
 */
function detectAITemplateWords(text) {
  const found = [];

  for (const word of AI_TEMPLATE_BLACKLIST) {
    if (text.includes(word)) {
      found.push(word);
    }
  }

  return found;
}

/**
 * 移除AI模板词
 * @param {string} text - 文本
 * @returns {string} 清理后的文本
 */
function removeAITemplateWords(text) {
  let result = text;

  for (const word of AI_TEMPLATE_BLACKLIST) {
    // 移除这些词及其后面的标点
    result = result.replace(new RegExp(word + '[，、：]?', 'g'), '');
  }

  return result;
}

/**
 * 随机选择句式起始词
 * @returns {string} 随机的起始词
 */
function getRandomSentenceStarter() {
  return SENTENCE_STARTERS[Math.floor(Math.random() * SENTENCE_STARTERS.length)];
}

/**
 * 随机选择情绪转折
 * @returns {string} 随机的情绪转折
 */
function getRandomEmotionalTransition() {
  return EMOTIONAL_TRANSITIONS[Math.floor(Math.random() * EMOTIONAL_TRANSITIONS.length)];
}

/**
 * 随机选择不完美表达
 * @returns {string} 随机的不完美表达
 */
function getRandomImperfectExpression() {
  return IMPERFECT_EXPRESSIONS[Math.floor(Math.random() * IMPERFECT_EXPRESSIONS.length)];
}

/**
 * 随机选择口头禅
 * @returns {string} 随机的口头禅
 */
function getRandomColloquialism() {
  return COLLOQUIALISMS_POOL[Math.floor(Math.random() * COLLOQUIALISMS_POOL.length)];
}

/**
 * 综合应用反AIGC策略
 * @param {string} text - 原始文本
 * @param {Object} options - 选项
 * @returns {Object} { text: 处理后的文本, applied: 应用的策略列表 }
 */
function applyAntiAIGCStrategies(text, options = {}) {
  const {
    wordVariationRate = 0.5,
    injectFillers = true,
    removeTemplateWords = true
  } = options;

  const applied = [];
  let result = text;

  // 1. 移除AI模板词
  if (removeTemplateWords) {
    const templateWords = detectAITemplateWords(result);
    if (templateWords.length > 0) {
      result = removeAITemplateWords(result);
      applied.push(`移除AI模板词: ${templateWords.join(', ')}`);
    }
  }

  // 2. 应用词汇多样性
  const beforeVariation = result;
  result = applyWordVariations(result, wordVariationRate);
  if (result !== beforeVariation) {
    applied.push('应用词汇多样性替换');
  }

  // 3. 注入口语化辅助词
  if (injectFillers) {
    const beforeFillers = result;
    result = injectColloquialFillers(result);
    if (result !== beforeFillers) {
      applied.push('注入口语化辅助词');
    }
  }

  return {
    text: result,
    applied: applied
  };
}

/**
 * 评估文本的AIGC特征
 * @param {string} text - 文本
 * @returns {Object} 评估结果
 */
function evaluateAIGCFeatures(text) {
  const features = {
    hasTemplateWords: false,
    templateWords: [],
    wordRepetition: 0,
    sentencePatternVariety: 0,
    avgSentenceLength: 0,
    score: 0 // 0-100，越高越像AI
  };

  // 检测AI模板词
  features.templateWords = detectAITemplateWords(text);
  features.hasTemplateWords = features.templateWords.length > 0;

  // 检测词汇重复度
  const words = text.match(/[\u4e00-\u9fa5]+/g) || [];
  const uniqueWords = new Set(words);
  features.wordRepetition = words.length > 0 ? (1 - uniqueWords.size / words.length) * 100 : 0;

  // 检测句子长度变化
  const sentences = text.split(/[。！？]/).filter(s => s.trim().length > 0);
  if (sentences.length > 0) {
    const lengths = sentences.map(s => s.length);
    features.avgSentenceLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

    // 计算长度标准差（衡量句式多样性）
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - features.avgSentenceLength, 2), 0) / lengths.length;
    features.sentencePatternVariety = Math.sqrt(variance);
  }

  // 计算综合评分
  let score = 0;

  // AI模板词权重最高（每个+20分）
  score += features.templateWords.length * 20;

  // 词汇重复度（高重复度+分）
  score += features.wordRepetition * 0.5;

  // 句式单一性（低多样性+分）
  if (features.sentencePatternVariety < 5) {
    score += 20;
  }

  // 句子长度过于规整（+分）
  if (features.avgSentenceLength > 20 && features.avgSentenceLength < 30) {
    score += 10;
  }

  features.score = Math.min(100, Math.round(score));

  return features;
}

export {
  WORD_VARIATIONS,
  COLLOQUIAL_FILLERS,
  CONDITIONAL_PATTERNS,
  SENTENCE_STARTERS,
  EMOTIONAL_TRANSITIONS,
  IMPERFECT_EXPRESSIONS,
  COLLOQUIALISMS_POOL,
  AI_TEMPLATE_BLACKLIST,
  applyWordVariations,
  injectColloquialFillers,
  detectAITemplateWords,
  removeAITemplateWords,
  getRandomSentenceStarter,
  getRandomEmotionalTransition,
  getRandomImperfectExpression,
  getRandomColloquialism,
  applyAntiAIGCStrategies,
  evaluateAIGCFeatures
};
