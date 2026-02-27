import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库路径 - 使用绝对路径或相对于项目根目录
const dbPath = process.env.DATABASE_PATH || './data/knowledge.db';
const db = new Database(dbPath);

// 启用外键
db.pragma('foreign_keys = ON');

console.log('📦 开始数据库迁移...');
console.log(`📍 数据库位置: ${dbPath}`);

try {
  // 开始事务
  db.exec('BEGIN TRANSACTION');

  // ==================== 1. AI提供商表 ====================
  console.log('⏳ 创建 ai_providers 表...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL UNIQUE,
      provider_name TEXT NOT NULL,
      api_key_encrypted TEXT,
      api_base_url TEXT,
      is_enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      timeout INTEGER DEFAULT 60000,
      max_retries INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ ai_providers 表创建成功');

  // ==================== 2. AI使用日志表 ====================
  console.log('⏳ 创建 ai_usage_logs 表...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      post_id INTEGER,
      operation TEXT NOT NULL,
      tokens_used INTEGER,
      cost REAL,
      duration_ms INTEGER,
      success INTEGER DEFAULT 1,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
    )
  `);
  console.log('✅ ai_usage_logs 表创建成功');

  // ==================== 3. 定时任务表 ====================
  console.log('⏳ 创建 scheduled_posts 表...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      schedule_type TEXT NOT NULL,
      scheduled_time DATETIME NOT NULL,
      schedule_config TEXT,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      last_error TEXT,
      next_run_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_next_run
    ON scheduled_posts(next_run_at, status)
  `);
  console.log('✅ scheduled_posts 表和索引创建成功');

  // ==================== 4. 定时任务执行日志表 ====================
  console.log('⏳ 创建 scheduled_execution_logs 表...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_execution_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheduled_post_id INTEGER NOT NULL,
      execution_time DATETIME NOT NULL,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      error_message TEXT,
      publish_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (scheduled_post_id) REFERENCES scheduled_posts(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ scheduled_execution_logs 表创建成功');

  // ==================== 5. 热点话题表 ====================
  console.log('⏳ 创建 trending_topics 表...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS trending_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      url TEXT,
      hot_score INTEGER,
      rank_position INTEGER,
      category TEXT,
      image_url TEXT,
      view_count INTEGER,
      first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      UNIQUE(platform, topic_id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trending_platform
    ON trending_topics(platform, is_active)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trending_score
    ON trending_topics(hot_score DESC)
  `);
  console.log('✅ trending_topics 表和索引创建成功');

  // ==================== 6. 热点抓取日志表 ====================
  console.log('⏳ 创建 trending_fetch_logs 表...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS trending_fetch_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      fetch_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL,
      topics_count INTEGER,
      duration_ms INTEGER,
      error_message TEXT
    )
  `);
  console.log('✅ trending_fetch_logs 表创建成功');

  // ==================== 7. 内容-热点关联表 ====================
  console.log('⏳ 创建 post_trending_topics 表...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_trending_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      trending_topic_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (trending_topic_id) REFERENCES trending_topics(id) ON DELETE CASCADE,
      UNIQUE(post_id, trending_topic_id)
    )
  `);
  console.log('✅ post_trending_topics 表创建成功');

  // ==================== 8. 每日统计表 ====================
  console.log('⏳ 创建 publish_stats_daily 表...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS publish_stats_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stat_date DATE NOT NULL UNIQUE,
      total_attempts INTEGER DEFAULT 0,
      successful_publishes INTEGER DEFAULT 0,
      failed_publishes INTEGER DEFAULT 0,
      total_retries INTEGER DEFAULT 0,
      avg_duration_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ publish_stats_daily 表创建成功');

  // ==================== 9. 修改posts表 ====================
  console.log('⏳ 检查并修改 posts 表...');

  // 检查列是否存在的辅助函数
  const checkColumn = (table, column) => {
    const result = db.prepare(`PRAGMA table_info(${table})`).all();
    return result.some(col => col.name === column);
  };

  if (!checkColumn('posts', 'ai_provider')) {
    db.exec(`ALTER TABLE posts ADD COLUMN ai_provider TEXT`);
    console.log('✅ posts表添加 ai_provider 列');
  }

  if (!checkColumn('posts', 'ai_model')) {
    db.exec(`ALTER TABLE posts ADD COLUMN ai_model TEXT`);
    console.log('✅ posts表添加 ai_model 列');
  }

  if (!checkColumn('posts', 'generation_cost')) {
    db.exec(`ALTER TABLE posts ADD COLUMN generation_cost REAL DEFAULT 0`);
    console.log('✅ posts表添加 generation_cost 列');
  }

  // ==================== 10. 重构publish_history表 ====================
  console.log('⏳ 检查并重构 publish_history 表...');

  // 检查是否需要迁移
  const hasOldStructure = !checkColumn('publish_history', 'duration_ms');

  if (hasOldStructure) {
    console.log('⏳ 发现旧版 publish_history，开始迁移...');

    // 重命名旧表
    db.exec(`ALTER TABLE publish_history RENAME TO publish_history_old`);

    // 创建新表
    db.exec(`
      CREATE TABLE publish_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        platform TEXT NOT NULL,
        status TEXT NOT NULL,
        xiaohongshu_id TEXT,
        note_url TEXT,
        retry_count INTEGER DEFAULT 0,
        is_retry INTEGER DEFAULT 0,
        original_attempt_id INTEGER,
        duration_ms INTEGER,
        upload_duration_ms INTEGER,
        publish_duration_ms INTEGER,
        error_code TEXT,
        error_message TEXT,
        error_details TEXT,
        response TEXT,
        images_count INTEGER DEFAULT 0,
        content_length INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
      )
    `);

    // 迁移旧数据
    db.exec(`
      INSERT INTO publish_history (id, post_id, platform, status, response, created_at)
      SELECT id, post_id, platform, status, response, created_at
      FROM publish_history_old
    `);

    // 删除旧表
    db.exec(`DROP TABLE publish_history_old`);

    console.log('✅ publish_history 表迁移完成');
  }

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_publish_status
    ON publish_history(status)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_publish_created
    ON publish_history(created_at DESC)
  `);
  console.log('✅ publish_history 索引创建成功');

  // ==================== 11. 插入默认AI提供商 ====================
  console.log('⏳ 插入默认AI提供商配置...');

  const defaultProviders = [
    { provider: 'anthropic', name: 'Anthropic Claude', priority: 100, url: 'https://api.anthropic.com' },
    { provider: 'openai', name: 'OpenAI', priority: 90, url: 'https://api.openai.com/v1' },
    { provider: 'qwen', name: '通义千问', priority: 80, url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    { provider: 'kimi', name: 'Moonshot Kimi', priority: 70, url: 'https://api.moonshot.cn/v1' },
    { provider: 'doubao', name: '字节豆包', priority: 60, url: 'https://ark.cn-beijing.volces.com/api/v3' },
    { provider: 'gemini', name: 'Google Gemini', priority: 50, url: 'https://generativelanguage.googleapis.com/v1beta' }
  ];

  const insertProvider = db.prepare(`
    INSERT OR IGNORE INTO ai_providers (provider, provider_name, priority, api_base_url, is_enabled)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const p of defaultProviders) {
    insertProvider.run(p.provider, p.name, p.priority, p.url, 0); // 默认禁用，需要配置API key
  }

  // 如果环境变量中有ANTHROPIC_API_KEY，自动启用Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    db.prepare(`UPDATE ai_providers SET is_enabled = 1 WHERE provider = 'anthropic'`).run();
    console.log('✅ 检测到ANTHROPIC_API_KEY，已启用Anthropic提供商');
  }

  console.log('✅ 默认AI提供商配置插入完成');

  // 提交事务
  db.exec('COMMIT');

  console.log('');
  console.log('========================================');
  console.log('✅ 数据库迁移完成！');
  console.log('========================================');
  console.log('');
  console.log('新增表:');
  console.log('  - ai_providers (AI提供商配置)');
  console.log('  - ai_usage_logs (AI使用日志)');
  console.log('  - scheduled_posts (定时任务)');
  console.log('  - scheduled_execution_logs (任务执行日志)');
  console.log('  - trending_topics (热点话题)');
  console.log('  - trending_fetch_logs (热点抓取日志)');
  console.log('  - post_trending_topics (内容-热点关联)');
  console.log('  - publish_stats_daily (每日统计)');
  console.log('');
  console.log('修改表:');
  console.log('  - posts (添加 ai_provider, ai_model, generation_cost)');
  console.log('  - publish_history (重构，添加详细指标)');
  console.log('');

  // 显示表统计
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  console.log(`📊 数据库现有 ${tables.length} 个表:`);
  tables.forEach(t => console.log(`  - ${t.name}`));

} catch (error) {
  // 回滚事务
  db.exec('ROLLBACK');
  console.error('');
  console.error('========================================');
  console.error('❌ 数据库迁移失败！');
  console.error('========================================');
  console.error('错误信息:', error.message);
  console.error('');
  process.exit(1);
} finally {
  db.close();
}
