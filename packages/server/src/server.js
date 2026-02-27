import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './models/database.js';
import router from './routes/index.js';
import schedulerService from './services/schedulerService.js';
import logger from './utils/logger.js';

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 提供知识库图片访问（用于产品图片预览）
if (process.env.KNOWLEDGE_BASE_PATH) {
  app.use('/knowledge', express.static(process.env.KNOWLEDGE_BASE_PATH));
}

app.use(express.static(path.join(__dirname, '../public')));

// API路由
app.use('/api', router);

// API 信息路由
app.get('/api', (req, res) => {
  res.json({
    name: '小红书知识库发布系统',
    version: '1.0.0',
    description: '私有知识库管理和AI文案生成发布系统',
    endpoints: {
      knowledge: '/api/knowledge',
      products: '/api/products',
      posts: '/api/posts',
      health: '/api/health',
    },
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error('错误:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || '服务器内部错误',
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
  });
});

// 初始化数据库并启动服务器
try {
  logger.info('正在初始化数据库...');
  initDatabase();
  logger.info('数据库初始化完成');

  // 清理不属于当前知识库的旧文档
  if (process.env.KNOWLEDGE_BASE_PATH) {
    try {
      const db = (await import('./models/database.js')).default;
      const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH;

      // 规范化路径用于LIKE匹配
      const normalizedPath = knowledgeBasePath.replace(/\//g, '\\');
      const pathPattern = normalizedPath.endsWith('\\') ? normalizedPath : normalizedPath + '\\';

      logger.info('🔍 检查知识库数据...');

      // === 清理知识库文档 ===
      const totalDocs = db.prepare('SELECT COUNT(*) as count FROM knowledge_docs').get();
      const currentDocs = db.prepare(
        'SELECT COUNT(*) as count FROM knowledge_docs WHERE file_path LIKE ? OR file_path = ?'
      ).get(`${pathPattern}%`, knowledgeBasePath);

      const oldDocsCount = totalDocs.count - currentDocs.count;

      if (oldDocsCount > 0) {
        logger.warn(`⚠️  发现 ${oldDocsCount} 个不属于当前知识库的旧文档`);
        logger.info(`📂 当前知识库路径: ${knowledgeBasePath}`);
        logger.info(`🗑️  正在清理旧文档...`);

        const deleteDocsStmt = db.prepare(
          'DELETE FROM knowledge_docs WHERE file_path NOT LIKE ? AND file_path != ?'
        );
        const docsResult = deleteDocsStmt.run(`${pathPattern}%`, knowledgeBasePath);

        logger.info(`✅ 已清理 ${docsResult.changes} 个旧知识库文档`);
      }

      // === 清理产品数据 ===
      const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get();
      const currentProducts = db.prepare(
        'SELECT COUNT(*) as count FROM products WHERE folder_path LIKE ? OR folder_path = ?'
      ).get(`${pathPattern}%`, knowledgeBasePath);

      const oldProductsCount = totalProducts.count - currentProducts.count;

      if (oldProductsCount > 0) {
        logger.warn(`⚠️  发现 ${oldProductsCount} 个不属于当前知识库的旧产品`);
        logger.info(`🗑️  正在清理旧产品...`);

        // 1. 先获取要删除的旧产品ID
        const oldProductsStmt = db.prepare('SELECT id FROM products WHERE folder_path NOT LIKE ? AND folder_path != ?');
        const oldProducts = oldProductsStmt.all(`${pathPattern}%`, knowledgeBasePath);
        const oldProductIds = oldProducts.map(p => p.id);

        if (oldProductIds.length > 0) {
          // 2. 删除关联到旧产品的文案
          const deletePostsStmt = db.prepare(`DELETE FROM posts WHERE product_id IN (${oldProductIds.join(',')})`);
          const postsResult = deletePostsStmt.run();
          if (postsResult.changes > 0) {
            logger.info(`   ✅ 已清理 ${postsResult.changes} 个关联文案`);
          }

          // 3. 删除旧产品
          const deleteProductsStmt = db.prepare(
            'DELETE FROM products WHERE folder_path NOT LIKE ? AND folder_path != ?'
          );
          const productsResult = deleteProductsStmt.run(`${pathPattern}%`, knowledgeBasePath);

          logger.info(`✅ 已清理 ${productsResult.changes} 个旧产品`);
        }
      }

      // === 显示最终统计 ===
      logger.info(`\n📊 当前知识库数据统计:`);
      logger.info(`   - 文档: ${currentDocs.count} 个`);
      logger.info(`   - 产品: ${currentProducts.count} 个`);
      logger.info(`   - 路径: ${knowledgeBasePath}\n`);

    } catch (cleanupError) {
      logger.error('⚠️  清理旧数据失败:', cleanupError.message);
      logger.warn('系统将继续启动，但可能存在旧数据');
    }
  } else {
    logger.warn('⚠️  未配置知识库路径 (KNOWLEDGE_BASE_PATH)');
  }

  // 启动定时发布调度器
  schedulerService.start();

  // 启动服务器，添加错误处理
  const server = app.listen(PORT, () => {
    logger.info(`
========================================
  小红书知识库发布系统
========================================
  服务器运行在: http://localhost:${PORT}
  API文档: http://localhost:${PORT}/api/health

  环境变量:
  - ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '已配置' : '未配置'}
  - KNOWLEDGE_BASE_PATH: ${process.env.KNOWLEDGE_BASE_PATH || '未配置'}
  - XIAOHONGSHU_MCP_PATH: ${process.env.XIAOHONGSHU_MCP_PATH || '未配置'}

  功能状态:
  - 定时发布调度器: ${schedulerService.isRunning ? '✅ 运行中' : '❌ 未运行'}
========================================
    `);
  });

  // 处理端口占用错误
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`❌ 端口 ${PORT} 已被占用`);
      logger.info(`
解决方法：
1. 使用 start.bat 或 start.ps1 自动清理端口
2. 手动终止占用端口的进程：
   - 查找进程: netstat -ano | findstr :${PORT}
   - 终止进程: taskkill /F /PID <进程ID>
3. 修改 .env 文件中的 PORT 配置使用其他端口
      `);
      process.exit(1);
    } else {
      logger.error('服务器启动失败:', error);
      process.exit(1);
    }
  });
} catch (error) {
  logger.error('启动失败:', error);
  process.exit(1);
}

// 优雅关闭
process.on('SIGINT', () => {
  logger.info('\n正在关闭服务器...');
  schedulerService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\n正在关闭服务器...');
  schedulerService.stop();
  process.exit(0);
});
