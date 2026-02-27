import Database from 'better-sqlite3';
import { encrypt } from '../../src/utils/crypto.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const db = new Database(path.join(__dirname, '../../data/knowledge.db'));

const deepseekApiKey = 'sk-ab5fab2597f4473ba583fdbede136d7e';

try {
  const encryptedKey = encrypt(deepseekApiKey);
  console.log('✅ DeepSeek API密钥已加密');

  const stmt = db.prepare(`
    UPDATE ai_providers
    SET api_key_encrypted = ?
    WHERE provider = 'deepseek'
  `);

  const result = stmt.run(encryptedKey);
  console.log(`✅ 已更新 DeepSeek 提供商的API密钥 (${result.changes} 行)`);

  const provider = db.prepare(`
    SELECT provider, provider_name, is_enabled, priority
    FROM ai_providers
    WHERE provider = 'deepseek'
  `).get();

  console.log('\nDeepSeek 提供商配置:');
  console.log(`  - 名称: ${provider.provider_name}`);
  console.log(`  - 状态: ${provider.is_enabled ? '✅ 启用' : '❌ 禁用'}`);
  console.log(`  - 优先级: ${provider.priority}`);

} catch (error) {
  console.error('❌ 更新失败:', error.message);
  process.exit(1);
} finally {
  db.close();
}
