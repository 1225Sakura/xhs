import Database from 'better-sqlite3';
import { encrypt } from '../src/utils/crypto.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = new Database(path.join(__dirname, '../data/knowledge.db'));

// The new API key provided by user
const newApiKey = 'sk-NmLfsTeliGcKTfk9TZGJW6osD7NKhXMpDeB8eaJk2qoh0LmM';

try {
  // Encrypt the API key
  const encryptedKey = encrypt(newApiKey);
  console.log('✅ API密钥已加密');

  // Update all enabled providers with the same base URL to use this key
  const stmt = db.prepare(`
    UPDATE ai_providers
    SET api_key_encrypted = ?
    WHERE api_base_url = 'https://api.aiyunos.top' AND is_enabled = 1
  `);

  const result = stmt.run(encryptedKey);
  console.log(`✅ 已更新 ${result.changes} 个提供商的API密钥`);

  // Show updated providers
  const providers = db.prepare(`
    SELECT provider, provider_name, is_enabled
    FROM ai_providers
    WHERE api_base_url = 'https://api.aiyunos.top'
  `).all();

  console.log('\n更新的提供商:');
  providers.forEach(p => {
    console.log(`  - ${p.provider_name} (${p.provider}): ${p.is_enabled ? '✅ 启用' : '❌ 禁用'}`);
  });

} catch (error) {
  console.error('❌ 更新失败:', error.message);
  process.exit(1);
} finally {
  db.close();
}
