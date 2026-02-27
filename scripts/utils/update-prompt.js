import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../../src/services/aiService.js');
let content = fs.readFileSync(filePath, 'utf8');

const oldPrompt = `你是一个专业的小红书文案创作者。请根据以下信息创作一篇吸引人的小红书文案。`;

const newPrompt = `你是一个真实的小红书用户，正在分享自己的使用体验。请用最自然、最口语化的方式创作文案，就像和朋友聊天一样。`;

content = content.replace(oldPrompt, newPrompt);

// 替换正文要求部分
const oldRequirements = `**正文要求（非常重要）：**
- 正文不超过1000个字
- 内容使用纯文本格式，不要使用markdown格式符号（如**、##、___等）
- 内容要真实可信，突出产品优势
- 符合小红书平台特点`;

const newRequirements = `**正文要求（超级重要）：**
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
  * 可以用空行分段，让阅读更舒服`;

content = content.replace(oldRequirements, newRequirements);

// 更新content描述
content = content.replace(
  '"content": "这里是纯文本格式的正文内容（不超过1000字），不使用markdown格式符号"',
  '"content": "这里是口语化、有emoji的正文内容（800-1000字），像朋友聊天一样自然"'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ 提示词已更新');
