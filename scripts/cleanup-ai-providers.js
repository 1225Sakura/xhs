/**
 * 清理AI提供商数据库
 * 只保留DeepSeek提供商，删除其他所有提供商
 */

import db from '../src/models/database.js';
import logger from '../src/utils/logger.js';

console.log('开始清理AI提供商数据库...\n');

try {
  // 查看当前所有提供商
  const allProviders = db.prepare('SELECT provider, provider_name, is_enabled FROM ai_providers').all();

  console.log('当前数据库中的提供商:');
  allProviders.forEach(p => {
    console.log(`  - ${p.provider} (${p.provider_name}) - ${p.is_enabled ? '已启用' : '已禁用'}`);
  });
  console.log('');

  // 删除除deepseek以外的所有提供商
  const deleteStmt = db.prepare(`
    DELETE FROM ai_providers
    WHERE provider != 'deepseek'
  `);

  const result = deleteStmt.run();

  console.log(`✅ 已删除 ${result.changes} 个非DeepSeek提供商\n`);

  // 显示清理后的提供商列表
  const remainingProviders = db.prepare('SELECT provider, provider_name, is_enabled FROM ai_providers').all();

  console.log('清理后的提供商列表:');
  if (remainingProviders.length === 0) {
    console.log('  (无提供商记录)');
  } else {
    remainingProviders.forEach(p => {
      console.log(`  - ${p.provider} (${p.provider_name}) - ${p.is_enabled ? '已启用' : '已禁用'}`);
    });
  }

  console.log('\n✅ 清理完成！');

} catch (error) {
  console.error('❌ 清理失败:', error.message);
  process.exit(1);
}
