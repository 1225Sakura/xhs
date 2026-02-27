import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/knowledge.db');
const dbDir = path.dirname(dbPath);

// 确保数据目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 创建表结构
export function initDatabase() {
  console.log('📦 开始数据库初始化...');

  // ==================== 原有表 ====================

  // 产品分类表
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 产品表
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      description TEXT,
      features TEXT,
      benefits TEXT,
      usage TEXT,
      folder_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // 产品图片表
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      file_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      image_type TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // 知识文档表
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      file_path TEXT NOT NULL UNIQUE,
      file_type TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 话术模板表
  db.exec(`
    CREATE TABLE IF NOT EXISTS scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      use_case TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 小红书文案表
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      product_id INTEGER,
      images TEXT,
      tags TEXT,
      status TEXT DEFAULT 'draft',
      xiaohongshu_id TEXT,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // 发布历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS publish_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);

  // ==================== 新增表 ====================

  // AI提供商配置表
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

  // AI使用日志表
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

  // 热门笔记缓存表（Phase 2）
  db.exec(`
    CREATE TABLE IF NOT EXISTS hot_posts_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      category TEXT,
      raw_data TEXT NOT NULL,
      processed_notes TEXT NOT NULL,
      analysis_result TEXT,
      source TEXT DEFAULT 'scraped',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      UNIQUE(keyword)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_hot_posts_keyword
    ON hot_posts_cache(keyword)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_hot_posts_expires
    ON hot_posts_cache(expires_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_hot_posts_category
    ON hot_posts_cache(category)
  `);

  // 定时发布任务表
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

  // 定时任务执行日志表
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

  // 热点话题表
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

  // 热点抓取日志表
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

  // 内容-热点关联表
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

  // 每日发布统计表
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

  // ==================== 账号管理表 ====================

  // 小红书账号表
  db.exec(`
    CREATE TABLE IF NOT EXISTS xhs_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL UNIQUE,
      phone TEXT,
      email TEXT,
      nickname TEXT,
      avatar_url TEXT,
      cookies TEXT,
      main_site_cookies TEXT,
      is_active INTEGER DEFAULT 1,
      is_primary INTEGER DEFAULT 0,
      login_status TEXT DEFAULT 'unknown',
      main_site_login_status TEXT DEFAULT 'unknown',
      last_login_at DATETIME,
      main_site_last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 账号使用日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      post_id INTEGER,
      success INTEGER DEFAULT 1,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES xhs_accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
    )
  `);

  // 创建账号索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_account_active
    ON xhs_accounts(is_active)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_account_primary
    ON xhs_accounts(is_primary)
  `);

  // ==================== 表字段迁移 ====================

  // 检查并添加posts表的新字段
  const postsInfo = db.prepare(`PRAGMA table_info(posts)`).all();
  const postsColumns = postsInfo.map(col => col.name);

  if (!postsColumns.includes('ai_provider')) {
    db.exec(`ALTER TABLE posts ADD COLUMN ai_provider TEXT`);
    console.log('✅ posts表添加 ai_provider 列');
  }

  if (!postsColumns.includes('ai_model')) {
    db.exec(`ALTER TABLE posts ADD COLUMN ai_model TEXT`);
    console.log('✅ posts表添加 ai_model 列');
  }

  if (!postsColumns.includes('generation_cost')) {
    db.exec(`ALTER TABLE posts ADD COLUMN generation_cost REAL DEFAULT 0`);
    console.log('✅ posts表添加 generation_cost 列');
  }

  // Phase 1优化：添加v2.2版本相关字段
  if (!postsColumns.includes('sensitive_words_found')) {
    db.exec(`ALTER TABLE posts ADD COLUMN sensitive_words_found TEXT`);
    console.log('✅ posts表添加 sensitive_words_found 列');
  }

  if (!postsColumns.includes('aigc_score')) {
    db.exec(`ALTER TABLE posts ADD COLUMN aigc_score REAL`);
    console.log('✅ posts表添加 aigc_score 列');
  }

  if (!postsColumns.includes('generation_stage')) {
    db.exec(`ALTER TABLE posts ADD COLUMN generation_stage TEXT DEFAULT 'v1'`);
    console.log('✅ posts表添加 generation_stage 列');
  }

  // 检查并添加xhs_accounts表的新字段
  const accountsInfo = db.prepare(`PRAGMA table_info(xhs_accounts)`).all();
  const accountsColumns = accountsInfo.map(col => col.name);

  if (!accountsColumns.includes('xhs_user_id')) {
    db.exec(`ALTER TABLE xhs_accounts ADD COLUMN xhs_user_id TEXT`);
    console.log('✅ xhs_accounts表添加 xhs_user_id 列');
  }

  if (!accountsColumns.includes('main_site_cookies')) {
    db.exec(`ALTER TABLE xhs_accounts ADD COLUMN main_site_cookies TEXT`);
    console.log('✅ xhs_accounts表添加 main_site_cookies 列');
  }

  if (!accountsColumns.includes('main_site_login_status')) {
    db.exec(`ALTER TABLE xhs_accounts ADD COLUMN main_site_login_status TEXT DEFAULT 'unknown'`);
    console.log('✅ xhs_accounts表添加 main_site_login_status 列');
  }

  if (!accountsColumns.includes('main_site_last_login_at')) {
    db.exec(`ALTER TABLE xhs_accounts ADD COLUMN main_site_last_login_at DATETIME`);
    console.log('✅ xhs_accounts表添加 main_site_last_login_at 列');
  }

  // 检查并重构publish_history表（如果需要）
  const historyInfo = db.prepare(`PRAGMA table_info(publish_history)`).all();
  const historyColumns = historyInfo.map(col => col.name);

  if (!historyColumns.includes('duration_ms')) {
    console.log('⏳ 检测到旧版 publish_history，开始迁移...');

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

  // 创建发布历史索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_publish_status
    ON publish_history(status)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_publish_created
    ON publish_history(created_at DESC)
  `);

  // ==================== 插入默认数据 ====================

  // 插入默认AI提供商（如果不存在）
  const providersCount = db.prepare(`SELECT COUNT(*) as count FROM ai_providers`).get();

  if (providersCount.count === 0) {
    const defaultProviders = [
      { provider: 'deepseek', name: 'DeepSeek', priority: 100, url: 'https://api.deepseek.com' }
    ];

    const insertProvider = db.prepare(`
      INSERT INTO ai_providers (provider, provider_name, priority, api_base_url, is_enabled)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const p of defaultProviders) {
      insertProvider.run(p.provider, p.name, p.priority, p.url, 0);
    }

    // 如果环境变量中有DEEPSEEK_API_KEY，自动启用DeepSeek
    if (process.env.DEEPSEEK_API_KEY) {
      db.prepare(`UPDATE ai_providers SET is_enabled = 1 WHERE provider = 'deepseek'`).run();
      console.log('✅ 检测到DEEPSEEK_API_KEY，已启用DeepSeek提供商');
    }

    console.log('✅ 默认AI提供商配置已插入');
  }

  console.log('✅ 数据库初始化完成');
}

export default db;
