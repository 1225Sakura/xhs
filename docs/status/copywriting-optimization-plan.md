# 文案生成功能优化实施计划

## 📋 项目概述

**目标**: 借鉴 xhs-ai-writer 项目，优化现有文案生成功能，实现双重专家系统、反AI检测、敏感词过滤等高级特性。

**参考项目**: https://github.com/EBOLABOY/xhs-ai-writer

**实施策略**: 渐进式升级（分3个阶段）

**主要AI提供商**: DeepSeek（用户指定）

---

## 🎯 优化目标

### 1. 双重专家系统
- **分析专家**: 抓取并分析小红书热门笔记，提取爆款公式
- **创作专家**: 基于爆款公式和用户素材生成内容

### 2. 反AI检测优化（目标AIGC率 <10%）
- 词汇多样性替换库
- 句式随机化策略
- 口语化辅助词注入
- 动词短语扩展
- 不完美表达模拟

### 3. 敏感词过滤系统
- 105+敏感词库（绝对化词语、医疗术语、夸大宣传等）
- 实时过滤与智能替换

### 4. Prompt工程升级
- 详细的创作指南
- 反流水账策略
- 生活化细节要求
- 字数精准控制（450-750字）
- 自检闭环机制

---

## 🏗️ 架构设计

### 当前架构
```
Controller (postController.js)
    ↓
Service (aiService.js)
    ↓
Provider Factory (aiProviderFactory.js)
    ↓
Provider Registry (providerRegistry.js)
    ↓
Multiple AI Providers (8个)
```

### 优化后架构
```
Controller (postController.js)
    ↓
┌─────────────────────────────────────┐
│  双重专家系统                          │
│  ┌──────────────┐  ┌──────────────┐ │
│  │ 分析专家      │  │ 创作专家      │ │
│  │ (热门笔记分析)│→ │ (内容生成)    │ │
���  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────┘
    ↓                    ↓
xhsScraperService   aiService (升级)
    ↓                    ↓
cacheService        sensitiveWordService
    ↓                    ↓
Database/File       Provider Factory
```

---

## 📊 数据库设计

### 新增表：hot_posts_cache

```sql
CREATE TABLE hot_posts_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  category TEXT,
  raw_data TEXT NOT NULL,           -- 原始笔记数据（JSON）
  processed_notes TEXT NOT NULL,    -- 处理后的笔记列表（JSON）
  analysis_result TEXT,             -- AI分析结果（JSON）
  source TEXT DEFAULT 'scraped',    -- 'scraped' | 'fallback'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,     -- 缓存过期时间（6小时后）
  UNIQUE(keyword)
);

CREATE INDEX idx_hot_posts_keyword ON hot_posts_cache(keyword);
CREATE INDEX idx_hot_posts_expires ON hot_posts_cache(expires_at);
```

### posts表新增字段

```sql
ALTER TABLE posts ADD COLUMN analysis_data TEXT;      -- 热门笔记分析数据
ALTER TABLE posts ADD COLUMN aigc_score REAL;         -- AIGC检测分数（0-100）
ALTER TABLE posts ADD COLUMN sensitive_words_found TEXT; -- 发现的敏感词（JSON）
ALTER TABLE posts ADD COLUMN generation_stage TEXT DEFAULT 'single'; -- 'single' | 'dual'
```

---

## 📁 文件组织

### 新增文件

```
src/
├── services/
│   ├── xhsScraperService.js      # 小红书热门笔记抓取
│   ├── cacheService.js           # 缓存管理（文件+数据库）
│   ├── sensitiveWordService.js   # 敏感词过滤
│   └── promptTemplates.js        # Prompt模板管理
├── utils/
│   ├── antiAigcStrategies.js     # 反AIGC检测策略
│   └── contentValidator.js       # 内容验证器
└── config/
    └── sensitiveWords.js         # 敏感词库配置

data/
└── cache/                        # 文件缓存目录
    └── hot_posts/                # 热门笔记缓存

docs/
└── status/
    └── copywriting-optimization-plan.md  # 本文档
```

### 修改文件

```
src/
├── services/
│   └── aiService.js              # 升级Prompt，集成双阶段生成
├── controllers/
│   └── postController.js         # 新增分析端点，修改生成端点
└── models/
    └── database.js               # 新增表和字段
```

---

## 🔄 实施阶段

### Phase 1: 基础设施搭建（优先级：高）

**目标**: 搭建敏感词过滤、反AIGC策略、Prompt升级等不依赖外部数据的功能

**任务清单**:
1. ✅ 创建 `sensitiveWordService.js`
   - 实现105+敏感词库
   - 实现检测和替换逻辑
   - 提供流式过滤接口

2. ✅ 创建 `antiAigcStrategies.js`
   - 词汇多样性替换库（WORD_VARIATIONS）
   - 口语化辅助词库（COLLOQUIAL_FILLERS）
   - 句式转换模板（CONDITIONAL_PATTERNS）
   - 不完美表达库（IMPERFECT_EXPRESSIONS）

3. ✅ 创建 `promptTemplates.js`
   - 迁移现有style guides
   - 新增v2.2版本的创作Prompt
   - 包含反AIGC策略、反流水账规则、自检闭环

4. ✅ 升级 `aiService.js`
   - 集成sensitiveWordService
   - 集成antiAigcStrategies
   - 使用新的promptTemplates
   - 添加内容验证逻辑

5. ✅ 修改 `postController.js`
   - 在生成后应用敏感词过滤
   - 记录敏感词发现情况
   - 返回AIGC评分（初步实现）

**测试验证**:
- 生成内容不包含敏感词
- 生成内容更自然（人工评估）
- 字数控制在450-750字
- 标题控制在20字以内

**预计时间**: 2-3天

---

### Phase 2: 热门笔记抓取与缓存（优先级：中）

**目标**: 实现热门笔记抓取、缓存管理，为双阶段生成做准备

**任务清单**:
1. ✅ 创建 `xhsScraperService.js`
   - 实现小红书搜索API调用
   - 处理Cookie认证
   - 解析笔记数据（标题、描述、互动数据）
   - 错误处理和重试机制

2. ✅ 创建 `cacheService.js`
   - 文件缓存实现（data/cache/hot_posts/）
   - 数据库缓存实现（hot_posts_cache表）
   - 缓存过期管理（6小时TTL）
   - 降级策略（同分类备用缓存）

3. ✅ 数据库迁移
   - 创建hot_posts_cache表
   - 添加posts表新字段
   - 创建索引

4. ✅ 环境变量配置
   - 添加XHS_COOKIE配置
   - 添加ENABLE_CACHE开关
   - 添加CACHE_TTL配置

5. ✅ 新增API端点
   - POST /api/posts/analyze-hot-posts
   - 接收keyword参数
   - 返回热门笔记数据和缓存状态

**测试验证**:
- 成功抓取40篇热门笔记
- 缓存正常工作（6小时内复用）
- Cookie失效时降级到备用缓存
- 数据正确存储到数据库

**预计时间**: 3-4天

---

### Phase 3: 双重专家系统集成（优先级：高）

**目标**: 实现完整的双阶段生成流程

**任务清单**:
1. ✅ 创建分析Prompt模板
   - 参考xhs-ai-writer的getAnalysisPrompt
   - 提取标题公式、内容结构、标签策略、封面风格
   - 严格JSON输出格式

2. ✅ 升级创作Prompt模板
   - 接收分析结果作为输入
   - 内化爆款规律到创作指南
   - 强化"基于用户素材"的约束

3. ✅ 修改 `aiService.js`
   - 新增 `analyzeHotPosts()` 方法
   - 新增 `generateWithAnalysis()` 方法
   - 实现双阶段调用流程

4. ✅ 修改 `postController.js`
   - 修改 `/api/posts/generate` 端点
   - 支持双阶段模式（可选）
   - 记录analysis_data到数据库

5. ✅ 前端集成
   - 添加"使用爆款分析"开关
   - 显示分析进度（可选）
   - 展示分析结果摘要

**测试验证**:
- 分析阶段正确提取爆款公式
- 创作阶段基于分析结果生成内容
- 生成内容质量提升（A/B测试）
- 双阶段模式可选（向后兼容）

**预计时间**: 4-5天

---

## 🔧 技术实现细节

### 1. 敏感词过滤实现

```javascript
// src/services/sensitiveWordService.js

class SensitiveWordService {
  constructor() {
    this.sensitiveWords = [
      // 绝对化词语
      '最', '第一', '顶级', '绝对', '唯一', '完美',
      // 医疗术语
      '治疗', '疗效', '治愈', '根治', '抗炎', '消炎',
      // 夸大宣传
      '秒杀', '彻底', '立竿见影', '100%有效', '神奇', '奇迹',
      // ... 共105+个
    ];

    this.replacements = {
      '最': '很',
      '第一': '优秀',
      '治疗': '改善',
      '疗效': '效果',
      // ...
    };

    this.regex = this.createRegex();
  }

  detect(text) {
    const found = [];
    const matches = text.matchAll(this.regex);
    for (const match of matches) {
      found.push({
        word: match[0],
        position: match.index,
        replacement: this.replacements[match[0]] || ''
      });
    }
    return found;
  }

  filter(text, autoReplace = true) {
    if (!autoReplace) {
      return { text, found: this.detect(text) };
    }

    let filtered = text;
    const found = [];

    for (const [word, replacement] of Object.entries(this.replacements)) {
      const regex = new RegExp(word, 'g');
      if (regex.test(filtered)) {
        found.push({ word, replacement });
        filtered = filtered.replace(regex, replacement);
      }
    }

    return { text: filtered, found };
  }
}
```

### 2. 反AIGC策略实现

```javascript
// src/utils/antiAigcStrategies.js

const WORD_VARIATIONS = {
  "使用": ["用", "试试", "上手", "整上", "搞个", "弄个"],
  "感觉": ["觉得", "感受是", "给我的感觉", "我的体验"],
  "推荐": ["安利", "墙裂推荐", "真的建议", "可以试试"],
  // ... 更多
};

const COLLOQUIAL_FILLERS = {
  "确认词": ["真的", "确实", "的确", "实在"],
  "惊讶词": ["居然", "竟然", "简直", "没想到"],
  "评估词": ["算是", "应该", "大概", "差不多"],
  // ...
};

function applyWordVariations(text) {
  let result = text;
  for (const [original, variations] of Object.entries(WORD_VARIATIONS)) {
    const regex = new RegExp(original, 'g');
    const matches = text.match(regex);
    if (matches) {
      // 随机替换部分匹配项
      matches.forEach((match, index) => {
        if (Math.random() > 0.5) {
          const replacement = variations[Math.floor(Math.random() * variations.length)];
          result = result.replace(match, replacement);
        }
      });
    }
  }
  return result;
}

function injectColloquialFillers(text) {
  // 在句子中随机注入口语化辅助词
  // 实现逻辑...
}

module.exports = {
  WORD_VARIATIONS,
  COLLOQUIAL_FILLERS,
  applyWordVariations,
  injectColloquialFillers
};
```

### 3. 热门笔记抓取实现

```javascript
// src/services/xhsScraperService.js

const axios = require('axios');
const cacheService = require('./cacheService');

class XhsScraperService {
  constructor() {
    this.apiUrl = 'https://edith.xiaohongshu.com/api/sns/web/v1/search/notes';
    this.cookie = process.env.XHS_COOKIE;
  }

  async scrapeHotPosts(keyword, targetCount = 40) {
    // 1. 检查缓存
    const cached = await cacheService.get(keyword);
    if (cached) {
      console.log(`✅ 使用缓存: ${keyword}`);
      return cached;
    }

    // 2. 抓取新数据
    try {
      const posts = await this.fetchFromXhs(keyword, targetCount);
      await cacheService.save(keyword, posts);
      return posts;
    } catch (error) {
      // 3. 降级到备用缓存
      const fallback = await cacheService.getFallback(keyword);
      if (fallback) {
        console.log(`🔄 使用备用缓存: ${fallback.keyword}`);
        return fallback.data;
      }
      throw error;
    }
  }

  async fetchFromXhs(keyword, targetCount) {
    const headers = {
      'cookie': this.cookie,
      'user-agent': 'Mozilla/5.0...',
      'referer': 'https://www.xiaohongshu.com/',
      // ... 其他headers
    };

    let allNotes = [];
    let page = 1;

    while (allNotes.length < targetCount && page <= 2) {
      const response = await axios.post(this.apiUrl, {
        keyword,
        page,
        page_size: 20,
        sort: 'popularity_descending'
      }, { headers });

      const notes = response.data.data.items
        .filter(item => item.model_type === 'note');

      allNotes = allNotes.concat(notes);
      page++;

      if (!response.data.data.has_more) break;
    }

    return this.processNotes(allNotes.slice(0, targetCount));
  }

  processNotes(notes) {
    return notes.map(item => ({
      title: item.note_card?.display_title || '无标题',
      desc: item.note_card?.desc || '无描述',
      interact_info: {
        liked_count: item.note_card?.interact_info?.liked_count || 0,
        comment_count: item.note_card?.interact_info?.comment_count || 0,
        collected_count: item.note_card?.interact_info?.collected_count || 0
      },
      note_id: item.id,
      user_info: {
        nickname: item.note_card?.user?.nickname || '未知用户'
      }
    }));
  }
}

module.exports = new XhsScraperService();
```

### 4. 双阶段生成流程

```javascript
// src/services/aiService.js (新增方法)

async function generateWithDualExpertSystem(productInfo, knowledgeBase, style, targetAudience, model) {
  // 阶段1: 分析专家 - 分析热门笔记
  const keyword = productInfo.category || productInfo.name;
  const hotPosts = await xhsScraperService.scrapeHotPosts(keyword);

  const analysisPrompt = promptTemplates.getAnalysisPrompt(hotPosts);
  const analysisResult = await callAIAPIWithFallback(model, [
    { role: 'user', content: analysisPrompt }
  ], 4000);

  // 解析分析结果
  const analysis = JSON.parse(analysisResult.content);

  // 阶段2: 创作专家 - 基于分析结果生成内容
  const creationPrompt = promptTemplates.getGenerationPrompt(
    JSON.stringify(analysis),
    JSON.stringify(productInfo),
    keyword
  );

  const contentResult = await callAIAPIWithFallback(model, [
    { role: 'user', content: creationPrompt }
  ], 4000);

  // 解析和清理内容
  const content = parseAndCleanContent(contentResult.content);

  // 应用敏感词过滤
  const filtered = sensitiveWordService.filter(content.content);
  content.content = filtered.text;

  return {
    ...content,
    analysis_data: analysis,
    sensitive_words_found: filtered.found
  };
}
```

---

## 🧪 测试策略

### 单元测试

```javascript
// tests/services/sensitiveWordService.test.js
describe('SensitiveWordService', () => {
  test('应该检测出敏感词', () => {
    const text = '这是最好的产品，100%有效';
    const found = service.detect(text);
    expect(found).toContainEqual(expect.objectContaining({ word: '最' }));
    expect(found).toContainEqual(expect.objectContaining({ word: '100%有效' }));
  });

  test('应该正确替换敏感词', () => {
    const text = '这是最好的产品';
    const { text: filtered } = service.filter(text);
    expect(filtered).toBe('这是很好的产品');
  });
});
```

### 集成测试

```javascript
// tests/integration/dualExpertSystem.test.js
describe('Dual Expert System', () => {
  test('应该成功完成双阶段生成', async () => {
    const result = await aiService.generateWithDualExpertSystem({
      name: '测试产品',
      category: '护肤',
      description: '保湿精华'
    }, '', '种草型', '大众', 'deepseek-chat');

    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('analysis_data');
    expect(result.content.length).toBeGreaterThan(450);
    expect(result.content.length).toBeLessThan(800);
  });
});
```

### Mock数据测试

```javascript
// 在没有真实XHS Cookie的情况下测试
const mockHotPosts = [
  {
    title: '平价好物｜这款精��真的绝了',
    desc: '用了一周，皮肤明显变好...',
    interact_info: { liked_count: 1200, comment_count: 89, collected_count: 456 }
  },
  // ... 更多mock数据
];

jest.mock('./xhsScraperService', () => ({
  scrapeHotPosts: jest.fn().mockResolvedValue(mockHotPosts)
}));
```

---

## ⚠️ 风险与缓解

### 风险1: 小红书Cookie失效
**影响**: 无法抓取热门笔记，双阶段生成失败

**缓解措施**:
- 实现6小时缓存机制，减少API调用频率
- 实现同分类备用缓存降级策略
- 提供单阶段生成作为fallback
- 在前端显示Cookie状态提示

### 风险2: API速率限制
**影响**: 频繁请求导致被限流或封禁

**缓解措施**:
- 实现请求间隔控制（每次请求间隔2-3秒）
- 使用缓存减少实际API调用
- 实现指数退避重试机制
- 监控API调用频率

### 风险3: 内容质量下降
**影响**: 过度优化导致内容不自然或不符合用户需求

**缓解措施**:
- 保留单阶段生成选项（向后兼容）
- 实现A/B测试对比质量
- 收集用户反馈
- 提供"AIGC强度"调节选项

### 风险4: 性能问题
**影响**: 双阶段生成耗时过长，用户体验差

**缓解措施**:
- 使用DeepSeek（成本低、速度快）
- 实现流式输出（可选）
- 优化Prompt长度
- 异步处理+进度反馈

### 风险5: 数据库迁移失败
**影响**: 新表或字段创建失败，功能无法使用

**缓解措施**:
- 实现数据库版本管理
- 提供回滚脚本
- 在测试环境充分验证
- 备份生产数据库

---

## 📈 成功指标

### 定量指标
- AIGC检测率 < 10%（使用第三方检测工具）
- 敏感词过滤准确率 > 95%
- 内容生成成功率 > 98%
- 平均生成时间 < 15秒（双阶段）
- 缓存命中率 > 60%

### 定性指标
- 生成内容更自然、更像真人写作
- 用户满意度提升
- 内容通过平台审核率提升
- 内容互动数据改善（点赞、收藏、评论）

---

## 📅 时间规划

| 阶段 | 任务 | 预计时间 | 负责人 |
|------|------|----------|--------|
| Phase 1 | 基础设施搭建 | 2-3天 | Claude |
| Phase 2 | 热门笔记抓取 | 3-4天 | Claude |
| Phase 3 | 双重专家系统 | 4-5天 | Claude |
| 测试 | 全面测试验证 | 2-3天 | Claude + User |
| 部署 | 生产环境部署 | 1天 | User |
| **总计** | | **12-16天** | |

---

## 🔄 向后兼容性

### 保持兼容的设计
1. **可选的双阶段模式**: 默认使用单阶段，通过参数启用双阶段
2. **渐进式增强**: 新功能不影响现有功能
3. **数据库字段可空**: 新字段允许NULL，不影响旧数据
4. **API参数可选**: 新参数都是可选的，有默认值

### 迁移路径
```javascript
// 旧的调用方式（继续支持）
POST /api/posts/generate
{
  "product_id": 1,
  "style": "种草型"
}

// 新的调用方式（启用双阶段）
POST /api/posts/generate
{
  "product_id": 1,
  "style": "种草型",
  "use_dual_expert": true,  // 新增参数
  "keyword": "护肤精华"      // 可选，用于热门笔记分析
}
```

---

## 📝 配置说明

### 环境变量

```bash
# 小红书Cookie（必需，用于热门笔记抓取）
XHS_COOKIE="your_xiaohongshu_cookie_here"

# 缓存开关（可选，默认true）
ENABLE_CACHE=true

# 缓存过期时间（可选，默认6小时，单位：小时）
CACHE_TTL=6

# DeepSeek API配置（推荐）
DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"

# 敏感词过滤开关（可选，默认true）
ENABLE_SENSITIVE_WORD_FILTER=true

# 反AIGC优化开关（可选，默认true）
ENABLE_ANTI_AIGC=true

# AIGC优化强度（可选，1-3，默认2）
# 1=轻度优化，2=中度优化，3=深度优化
ANTI_AIGC_LEVEL=2
```

---

## 🎓 学习要点

### 从xhs-ai-writer学到的关键技术

1. **双重专家系统的价值**
   - 分析阶段提取真实爆款规律
   - 创作阶段基于规律而非模板
   - 避免生成通用化内容

2. **反AIGC检测的系统性方法**
   - 词汇多样性（同义词替换）
   - 句式随机化（避免固定模式）
   - 不完美性（模拟真人写作特征）
   - 细节随机性（避免整数、固定时间）

3. **Prompt工程的深度**
   - 详细的约束条件
   - 自检闭环机制
   - 反面示例（禁止使用的词汇）
   - 人设注入（从AI助手到朋友）

4. **缓存策略的重要性**
   - 减少API调用成本
   - 提升响应速度
   - 降级策略保证可用性

---

## ✅ 验收标准

### Phase 1 验收
- [ ] 敏感词过滤正常工作
- [ ] 生成内容包含反AIGC优化特征
- [ ] Prompt模板完整迁移
- [ ] 单元测试通过率100%

### Phase 2 验收
- [ ] 成功抓取热门笔记（使用真实Cookie）
- [ ] 缓存机制正常工作
- [ ] 数据库表和字段创建成功
- [ ] 降级策略有效

### Phase 3 验收
- [ ] 双阶段生成流程完整
- [ ] 分析结果格式正确
- [ ] 创作内容基于分析结果
- [ ] 前端集成完成
- [ ] 集成测试通过

### 最终验收
- [ ] 所有测试通过
- [ ] 性能指标达标
- [ ] 文档完整
- [ ] 用户验收通过

---

**文档版本**: 1.0
**创建日期**: 2026-02-03
**最后更新**: 2026-02-03
**维护者**: Claude Sonnet 4.5
