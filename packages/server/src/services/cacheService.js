/**
 * 缓存管理服务
 *
 * 功能：
 * - 文件缓存（data/cache/hot_posts/）
 * - 数据库缓存（hot_posts_cache表）
 * - 6小时TTL过期管理
 * - 降级策略（同分类备用缓存）
 *
 * 参考：xhs-ai-writer 缓存管理实现
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../models/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 缓存配置
const CACHE_CONFIG = {
  TTL: parseInt(process.env.CACHE_TTL || '6') * 60 * 60 * 1000, // 默认6小时，转换为毫秒
  ENABLED: process.env.ENABLE_CACHE !== 'false',
  FILE_CACHE_DIR: path.join(process.cwd(), 'data', 'cache', 'hot_posts'),
  MAX_FALLBACK_AGE: 30 * 24 * 60 * 60 * 1000 // 备用缓存最大年龄：30天
};

/**
 * 缓存管理服务类
 */
class CacheService {
  constructor() {
    this.ensureCacheDirectory();
  }

  /**
   * 确保缓存目录存在
   */
  ensureCacheDirectory() {
    if (!fs.existsSync(CACHE_CONFIG.FILE_CACHE_DIR)) {
      fs.mkdirSync(CACHE_CONFIG.FILE_CACHE_DIR, { recursive: true });
      console.log('✅ 缓存目录已创建:', CACHE_CONFIG.FILE_CACHE_DIR);
    }
  }

  /**
   * 获取缓存数据
   * @param {string} keyword - 关键词
   * @returns {Promise<Object|null>} 缓存数据或null
   */
  async get(keyword) {
    if (!CACHE_CONFIG.ENABLED) {
      return null;
    }

    try {
      // 1. 尝试从数据库获取
      const dbCache = await this.getFromDatabase(keyword);
      if (dbCache && !this.isExpired(dbCache.created_at, dbCache.expires_at)) {
        console.log(`✅ 数据库缓存命中: ${keyword}`);
        return {
          data: dbCache.raw_data,
          processedNotes: JSON.parse(dbCache.processed_notes),
          source: dbCache.source,
          createdAt: dbCache.created_at
        };
      }

      // 2. 尝试从文件获取
      const fileCache = await this.getFromFile(keyword);
      if (fileCache && !this.isExpired(fileCache.createdAt)) {
        console.log(`✅ 文件缓存命中: ${keyword}`);
        return fileCache;
      }

      return null;
    } catch (error) {
      console.warn('⚠️ 获取缓存失败:', error.message);
      return null;
    }
  }

  /**
   * 从数据库获取缓存
   * @param {string} keyword - 关键词
   * @returns {Promise<Object|null>} 缓存数据或null
   */
  async getFromDatabase(keyword) {
    try {
      const stmt = db.prepare(`
        SELECT * FROM hot_posts_cache
        WHERE keyword = ?
        ORDER BY created_at DESC
        LIMIT 1
      `);
      return stmt.get(keyword);
    } catch (error) {
      console.warn('⚠️ 数据库查询失败:', error.message);
      return null;
    }
  }

  /**
   * 从文件获取缓存
   * @param {string} keyword - 关键词
   * @returns {Promise<Object|null>} 缓存数据或null
   */
  async getFromFile(keyword) {
    try {
      const filePath = this.getFilePath(keyword);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const cacheData = JSON.parse(fileContent);

      return cacheData;
    } catch (error) {
      console.warn('⚠️ 文件读取失败:', error.message);
      return null;
    }
  }

  /**
   * 保存缓存数据
   * @param {string} keyword - 关键词
   * @param {string} rawData - 原始数据（文本格式）
   * @param {Array} processedNotes - 处理后的笔记列表
   * @param {string} source - 数据来源（'scraped' | 'fallback'）
   * @returns {Promise<boolean>} 是否保存成功
   */
  async save(keyword, rawData, processedNotes, source = 'scraped') {
    if (!CACHE_CONFIG.ENABLED) {
      return false;
    }

    try {
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + CACHE_CONFIG.TTL).toISOString();

      // 1. 保存到数据库
      await this.saveToDatabase(keyword, rawData, processedNotes, source, now, expiresAt);

      // 2. 保存到文件
      await this.saveToFile(keyword, rawData, processedNotes, source, now);

      console.log(`✅ 缓存已保存: ${keyword} (${source})`);
      return true;
    } catch (error) {
      console.error('❌ 保存缓存失败:', error.message);
      return false;
    }
  }

  /**
   * 保存到数据库
   */
  async saveToDatabase(keyword, rawData, processedNotes, source, createdAt, expiresAt) {
    try {
      // 提取分类（从第一篇笔记的标题或描述中推断）
      const category = this.inferCategory(processedNotes);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO hot_posts_cache
        (keyword, category, raw_data, processed_notes, source, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        keyword,
        category,
        rawData,
        JSON.stringify(processedNotes),
        source,
        createdAt,
        expiresAt
      );
    } catch (error) {
      console.warn('⚠️ 数据库保存失败:', error.message);
    }
  }

  /**
   * 保存到文件
   */
  async saveToFile(keyword, rawData, processedNotes, source, createdAt) {
    try {
      const filePath = this.getFilePath(keyword);
      const cacheData = {
        keyword,
        data: rawData,
        processedNotes,
        source,
        createdAt,
        expiresAt: new Date(Date.now() + CACHE_CONFIG.TTL).toISOString()
      };

      fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    } catch (error) {
      console.warn('⚠️ 文件保存失败:', error.message);
    }
  }

  /**
   * 获取备用缓存（同分类的其他关键词）
   * @param {string} keyword - 关键词
   * @returns {Promise<Object|null>} 备用缓存数据或null
   */
  async getFallback(keyword) {
    if (!CACHE_CONFIG.ENABLED) {
      return null;
    }

    try {
      // 推断当前关键词的分类
      const category = this.inferCategoryFromKeyword(keyword);

      // 查找同分类的其他缓存（30天内的）
      const stmt = db.prepare(`
        SELECT * FROM hot_posts_cache
        WHERE category = ? AND keyword != ?
        AND datetime(created_at) > datetime('now', '-30 days')
        ORDER BY created_at DESC
        LIMIT 1
      `);

      const fallbackCache = stmt.get(category, keyword);

      if (fallbackCache) {
        console.log(`🔄 使用备用缓存: ${fallbackCache.keyword} (分类: ${category})`);
        return {
          keyword: fallbackCache.keyword,
          data: fallbackCache.raw_data,
          processedNotes: JSON.parse(fallbackCache.processed_notes),
          source: 'fallback',
          createdAt: fallbackCache.created_at
        };
      }

      return null;
    } catch (error) {
      console.warn('⚠️ 获取备用缓存失败:', error.message);
      return null;
    }
  }

  /**
   * 清理过期缓存
   * @returns {Promise<number>} 清理的缓存数量
   */
  async cleanExpired() {
    try {
      // 1. 清理数据库中的过期缓存
      const stmt = db.prepare(`
        DELETE FROM hot_posts_cache
        WHERE datetime(expires_at) < datetime('now')
      `);
      const result = stmt.run();

      // 2. 清理文件缓存
      const files = fs.readdirSync(CACHE_CONFIG.FILE_CACHE_DIR);
      let filesCleaned = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(CACHE_CONFIG.FILE_CACHE_DIR, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const cacheData = JSON.parse(content);

          if (this.isExpired(cacheData.createdAt, cacheData.expiresAt)) {
            fs.unlinkSync(filePath);
            filesCleaned++;
          }
        } catch (error) {
          // 文件损坏，删除
          fs.unlinkSync(filePath);
          filesCleaned++;
        }
      }

      const totalCleaned = result.changes + filesCleaned;
      if (totalCleaned > 0) {
        console.log(`🧹 清理了${totalCleaned}个过期缓存`);
      }

      return totalCleaned;
    } catch (error) {
      console.error('❌ 清理缓存失败:', error.message);
      return 0;
    }
  }

  /**
   * 检查缓存是否过期
   * @param {string} createdAt - 创建时间
   * @param {string} expiresAt - 过期时间（可选）
   * @returns {boolean} 是否过期
   */
  isExpired(createdAt, expiresAt = null) {
    try {
      if (expiresAt) {
        return new Date(expiresAt) < new Date();
      }

      const createdTime = new Date(createdAt).getTime();
      const now = Date.now();
      return (now - createdTime) > CACHE_CONFIG.TTL;
    } catch (error) {
      return true; // 解析失败视为过期
    }
  }

  /**
   * 获取文件路径
   * @param {string} keyword - 关键词
   * @returns {string} 文件路径
   */
  getFilePath(keyword) {
    // 使用关键词的hash作为文件名，避免特殊字符问题
    const hash = this.simpleHash(keyword);
    return path.join(CACHE_CONFIG.FILE_CACHE_DIR, `${hash}.json`);
  }

  /**
   * 简单hash函数
   * @param {string} str - 字符串
   * @returns {string} hash值
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 从笔记列表推断分类
   * @param {Array} notes - 笔记列表
   * @returns {string} 分类
   */
  inferCategory(notes) {
    if (!notes || notes.length === 0) {
      return '其他';
    }

    // 简单的分类推断：基于标题和描述中的关键词
    const text = notes.slice(0, 5).map(n => n.title + ' ' + n.desc).join(' ');

    const categories = {
      '美妆': ['美妆', '化妆', '护肤', '口红', '粉底', '精华', '面膜'],
      '穿搭': ['穿搭', '服装', '搭配', '时尚', '衣服', '裤子', '裙子'],
      '美食': ['美食', '食谱', '做饭', '餐厅', '好吃', '零食', '甜品'],
      '旅游': ['旅游', '旅行', '景点', '酒店', '攻略', '打卡'],
      '健身': ['健身', '运动', '减肥', '瑜伽', '跑步', '锻炼'],
      '数码': ['数码', '手机', '电脑', '相机', '耳机', '科技'],
      '家居': ['家居', '装修', '家具', '收纳', '清洁', '家电']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return '其他';
  }

  /**
   * 从关键词推断分类
   * @param {string} keyword - 关键词
   * @returns {string} 分类
   */
  inferCategoryFromKeyword(keyword) {
    const categories = {
      '美妆': ['美妆', '化妆', '护肤', '口红', '粉底', '精华', '面膜'],
      '穿搭': ['穿搭', '服装', '搭配', '时尚', '衣服', '裤子', '裙子'],
      '美食': ['美食', '食谱', '做饭', '餐厅', '好吃', '零食', '甜品'],
      '旅游': ['旅游', '旅行', '景点', '酒店', '攻略', '打卡'],
      '健身': ['健身', '运动', '减肥', '瑜伽', '跑步', '锻炼'],
      '数码': ['数码', '手机', '电脑', '相机', '耳机', '科技'],
      '家居': ['家居', '装修', '家具', '收纳', '清洁', '家电']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => keyword.includes(kw))) {
        return category;
      }
    }

    return '其他';
  }

  /**
   * 获取缓存统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStats() {
    try {
      const stmt = db.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN datetime(expires_at) > datetime('now') THEN 1 END) as valid,
          COUNT(CASE WHEN datetime(expires_at) <= datetime('now') THEN 1 END) as expired
        FROM hot_posts_cache
      `);
      const dbStats = stmt.get();

      const files = fs.readdirSync(CACHE_CONFIG.FILE_CACHE_DIR);
      const fileCount = files.filter(f => f.endsWith('.json')).length;

      return {
        database: dbStats,
        files: fileCount,
        ttl: CACHE_CONFIG.TTL / (60 * 60 * 1000) + '小时',
        enabled: CACHE_CONFIG.ENABLED
      };
    } catch (error) {
      console.error('❌ 获取统计信息失败:', error.message);
      return null;
    }
  }

  /**
   * 获取热门笔记（主入口方法）
   * 集成缓存检查和爬虫获取
   *
   * @param {string} keyword - 搜索关键词
   * @param {string} category - 分类（可选，用于降级）
   * @returns {Promise<Array>} 热门笔记数组
   */
  async getHotPosts(keyword, category = null) {
    try {
      // 1. 尝试从缓存获取
      const cached = await this.get(keyword);
      if (cached && cached.processedNotes) {
        console.log(`✅ 从缓存获取热门笔记: ${keyword} (${cached.processedNotes.length}篇)`);
        return cached.processedNotes;
      }

      // 2. 缓存未命中，使用爬虫获取
      console.log(`🔍 缓存未命中，开始爬取热门笔记: ${keyword}`);

      // 动态导入爬虫服务（单例）
      const { default: scraperService } = await import('./xhsScraperService.js');

      const notes = await scraperService.scrapeHotPosts(keyword);

      if (!notes || notes.length === 0) {
        console.log(`⚠️  未爬取到热门笔记: ${keyword}`);

        // 3. 尝试降级策略
        if (category) {
          console.log(`🔄 尝试降级策略，使用分类: ${category}`);
          const fallback = await this.getFallback(category);
          if (fallback && fallback.processedNotes) {
            console.log(`✅ 使用降级缓存: ${category} (${fallback.processedNotes.length}篇)`);
            return fallback.processedNotes;
          }
        }

        return null;
      }

      // 4. 格式化为文本并保存到缓存
      const rawText = scraperService.formatNotesAsText(keyword, notes);
      await this.save(keyword, rawText, notes, 'scraped');
      console.log(`✅ 爬取并缓存热门笔记: ${keyword} (${notes.length}篇)`);

      return notes;

    } catch (error) {
      console.error(`❌ 获取热门笔记失败: ${keyword}`, error.message);

      // 5. 错误时尝试降级
      if (category) {
        try {
          const fallback = await this.getFallback(category);
          if (fallback && fallback.processedNotes) {
            console.log(`✅ 错误降级，使用分类缓存: ${category}`);
            return fallback.processedNotes;
          }
        } catch (fallbackError) {
          console.error('❌ 降级策略也失败:', fallbackError.message);
        }
      }

      return null;
    }
  }
}

// 导出单例
export default new CacheService();
