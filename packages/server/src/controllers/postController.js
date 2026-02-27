import db from '../models/database.js';
import logger from '../utils/logger.js';
import { generateXhsContent, generateXhsContentV2, generateWithDualExpertSystem, optimizeContent } from '../services/aiService.js';
import multiAccountPublishService from '../services/multiAccountPublishService.js';
import publishHistoryService from '../services/publishHistoryService.js';
import accountService from '../services/accountService.js';
import accountManagementService from '../services/accountManagementService.js';
import grammarCheckService from '../services/grammarCheckService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 获取所有文案
 */
export function getAllPosts(req, res) {
  try {
    const { status, product_id } = req.query;
    let query = `
      SELECT p.*, pr.name as product_name
      FROM posts p
      LEFT JOIN products pr ON p.product_id = pr.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (product_id) {
      query += ' AND p.product_id = ?';
      params.push(product_id);
    }

    query += ' ORDER BY p.created_at DESC';

    const stmt = db.prepare(query);
    const posts = stmt.all(...params);

    // 解析JSON字段
    posts.forEach(post => {
      try {
        post.images = JSON.parse(post.images || '[]');
        post.tags = JSON.parse(post.tags || '[]');
      } catch (e) {
        post.images = [];
        post.tags = [];
      }
    });

    res.json({
      success: true,
      data: posts,
    });
  } catch (error) {
    logger.error('获取文案列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 获取文案详情
 */
export function getPostById(req, res) {
  try {
    const { id } = req.params;

    const stmt = db.prepare(`
      SELECT p.*, pr.name as product_name
      FROM posts p
      LEFT JOIN products pr ON p.product_id = pr.id
      WHERE p.id = ?
    `);
    const post = stmt.get(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: '文案不存在',
      });
    }

    // 解析JSON字段
    try {
      post.images = JSON.parse(post.images || '[]');
      post.tags = JSON.parse(post.tags || '[]');
    } catch (e) {
      post.images = [];
      post.tags = [];
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    logger.error('获取文案详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * AI生成文案
 */
export async function generatePost(req, res) {
  try {
    const { product_id, style, target_audience, knowledge_docs, model, use_v2, use_dual_expert, keyword, learn_from_hot, hot_keywords, word_count } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        error: '请选择产品',
      });
    }

    // 获取产品信息
    const productStmt = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `);
    const product = productStmt.get(product_id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: '产品不存在',
      });
    }

    // 获取相关知识库内容
    let knowledgeBase = '';
    if (knowledge_docs && knowledge_docs.length > 0) {
      const docsStmt = db.prepare(`
        SELECT content FROM knowledge_docs
        WHERE id IN (${knowledge_docs.map(() => '?').join(',')})
      `);
      const docs = docsStmt.all(...knowledge_docs);
      knowledgeBase = docs.map(d => d.content).join('\n\n');
    }

    // Phase 2: 获取热门笔记（如果启用）
    let hotPosts = null;
    if (learn_from_hot && use_v2 !== false) {
      logger.info('🔥 启用热门笔记学习功能');
      try {
        const { default: cacheService } = await import('../services/cacheService.js');
        const searchKeyword = hot_keywords || product.category_name || product.name;
        logger.info(`🔍 搜索关键词: ${searchKeyword}`);

        hotPosts = await cacheService.getHotPosts(searchKeyword, product.category_name);

        if (hotPosts && hotPosts.length > 0) {
          logger.info(`✅ 获取到 ${hotPosts.length} 篇热门笔记`);
        } else {
          logger.info('⚠️  未获取到热门笔记，将使用普通v2.2模式');
        }
      } catch (error) {
        logger.error('❌ 获取热门笔记失败:', error.message);
        logger.info('⚠️  降级到普通v2.2模式');
      }
    }

    // 选择生成模式
    let generateFunction;
    let generationMode;

    if (use_dual_expert === true) {
      // 双重专家系统（Phase 2）
      generateFunction = generateWithDualExpertSystem;
      generationMode = 'dual-expert';
      logger.info('🎯 使用双重专家系统生成文案');
    } else if (use_v2 !== false) {
      // v2.2高级版本（Phase 1）或 v2.3（Phase 2 with hot posts）
      generateFunction = generateXhsContentV2;
      generationMode = hotPosts ? 'v2.3' : 'v2.2';
      logger.info(`🎯 使用${generationMode}版本生成文案`);
    } else {
      // v1基础版本
      generateFunction = generateXhsContent;
      generationMode = 'v1';
      logger.info('🎯 使用v1基础版本生成文案');
    }

    // 调用AI生成文案
    const result = await generateFunction({
      productInfo: {
        name: product.name,
        category: product.category_name,
        description: product.description,
        features: product.features,
        benefits: product.benefits,
        usage: product.usage,
      },
      knowledgeBase: knowledgeBase.substring(0, 10000), // 限制长度
      style: style || '种草型',
      targetAudience: target_audience || '大众',
      model: model || 'deepseek-chat',
      keyword: keyword || product.category_name, // 用于双阶段模式
      hotPosts: hotPosts, // Phase 2: 传递热门笔记数据
      wordCount: word_count || 800, // 目标字数，默认800字
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // 保存草稿（包含图片信息和AI信息）
    const { images } = req.body; // 获取前端传来的图片

    // 准备额外的元数据
    const metadata = result.metadata || {};
    const sensitiveWordsJson = JSON.stringify(metadata.sensitive_words_found || []);
    const aigcScore = metadata.aigc_score || null;

    const insertStmt = db.prepare(`
      INSERT INTO posts (
        title, content, product_id, images, tags, status,
        ai_provider, ai_model, generation_cost,
        sensitive_words_found, aigc_score, generation_stage
      )
      VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
    `);

    const insertResult = insertStmt.run(
      result.data.title,
      result.data.content,
      product_id,
      JSON.stringify(images || []), // 保存图片
      JSON.stringify(result.data.tags || []),
      result.provider || null,
      result.model || model,
      result.cost || 0,
      sensitiveWordsJson,
      aigcScore,
      generationMode // 保存生成模式（v1/v2/dual-expert）
    );

    // 添加generation_stage到元数据
    if (metadata) {
      metadata.generation_stage = generationMode;
    }

    res.json({
      success: true,
      data: {
        id: insertResult.lastInsertRowid,
        ...result.data,
      },
      cost: result.cost, // 返回成本
      metadata: metadata // 返回元数据（AIGC评分、敏感词、生成阶段等）
    });
  } catch (error) {
    logger.error('生成文案失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 优化文案
 */
export async function optimizePost(req, res) {
  try {
    const { id } = req.params;
    const { requirements } = req.body;

    // 获取文案
    const stmt = db.prepare('SELECT * FROM posts WHERE id = ?');
    const post = stmt.get(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: '文案不存在',
      });
    }

    // 调用AI优化
    const result = await optimizeContent(post.content, requirements || '让文案更吸引人');

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // 更新文案
    const updateStmt = db.prepare(`
      UPDATE posts
      SET content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(result.data, id);

    res.json({
      success: true,
      data: {
        content: result.data,
      },
    });
  } catch (error) {
    logger.error('优化文案失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 发布到小红书
 */
export async function publishToXhs(req, res) {
  try {
    const { id } = req.params;
    const { images: customImages, account_id } = req.body; // 支持自定义图片和指定账户

    // 获取要使用的账户
    let targetAccount;
    if (account_id) {
      // 如果指定了账户 ID，使用指定的账户
      targetAccount = accountManagementService.getAccountById(account_id);
      if (!targetAccount) {
        return res.status(400).json({
          success: false,
          error: '指定的账户不存在',
        });
      }
    } else {
      // 否则使用当前活跃账户
      targetAccount = accountManagementService.getActiveAccount();
      if (!targetAccount) {
        return res.status(400).json({
          success: false,
          error: '发布失败：未设置活跃账户。请先在账号管理中添加并设置账户。',
        });
      }
    }

    // 检查账户是否已登录
    if (targetAccount.login_status !== 'logged_in') {
      return res.status(400).json({
        success: false,
        error: `账户"${targetAccount.account_name}"未登录，请先登录后再发布。`,
      });
    }

    logger.info(`📱 使用账号发布: ${targetAccount.account_name} (ID: ${targetAccount.id})`);

    // 获取文案
    const stmt = db.prepare('SELECT * FROM posts WHERE id = ?');
    const post = stmt.get(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: '文案不存在',
      });
    }

    // 解析图片
    let images = [];
    try {
      // 优先使用自定义图片，否则使用文案保存的图片
      if (customImages && customImages.length > 0) {
        images = customImages;
      } else {
        images = JSON.parse(post.images || '[]');
      }
    } catch (e) {
      images = [];
    }

    // 检查是否有图片
    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: '发布失败：小红书要求至少上传1张图片。请先添加图片后再发布。',
      });
    }

    // 处理知识库图片：复制到uploads目录
    // MCP服务的浏览器自动化无法直接上传只读挂载的知识库图片
    const processedImages = [];

    // 获取项目根目录（支持跨平台）
    const projectRoot = path.resolve(__dirname, '../..');
    const knowledgeDir = path.join(projectRoot, '知识库');
    const uploadsDir = path.join(projectRoot, 'uploads', 'images');

    // 确保uploads目录存在
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    for (const img of images) {
      logger.info('🔍 检查图片路径:', img);

      // 检查是否是知识库图片（支持多种路径格式）
      // 如果路径不是以 /uploads/ 或 uploads/ 开头，则认为是知识库图片
      const isKnowledgeImage = !img.startsWith('/uploads/') &&
                               !img.startsWith('uploads/') &&
                               !img.startsWith('/app/') &&
                               (img.startsWith('/knowledge/') ||
                                img.startsWith('知识库/') ||
                                img.includes('/知识库/') ||
                                img.includes('\\知识库\\') ||
                                img.includes('knowledge/') ||
                                img.startsWith('产品资料/'));

      logger.info('  是否知识库图片:', isKnowledgeImage);

      if (isKnowledgeImage) {
        try {
          // 生成目标文件名（使用纯ASCII文件名，避免中文字符导致的问题）
          const originalExt = path.extname(img); // 保留扩展名如 .jpg
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 1000000000);
          const targetFileName = `xhs-${timestamp}-${random}${originalExt}`; // 例如: xhs-1765182000000-123456789.jpg

          // 确定源路径（支持Windows和Linux路径）
          let sourcePath = '';

          if (img.startsWith('/knowledge/')) {
            // Docker容器路径 /knowledge/xxx -> 本地知识库/xxx
            const relativePath = img.substring('/knowledge/'.length);
            sourcePath = path.join(knowledgeDir, relativePath);
          } else if (img.startsWith('知识库/') || img.startsWith('知识库\\')) {
            // 相对路径 知识库/xxx -> 本地知识库/xxx
            const relativePath = img.substring('知识库/'.length).replace(/\\/g, '/');
            sourcePath = path.join(knowledgeDir, relativePath);
          } else {
            // 尝试提取知识库后的相对路径
            let knowledgeIndex = img.indexOf('/知识库/');
            if (knowledgeIndex < 0) knowledgeIndex = img.indexOf('\\知识库\\');
            if (knowledgeIndex < 0) knowledgeIndex = img.indexOf('知识库/');
            if (knowledgeIndex < 0) knowledgeIndex = img.indexOf('知识库\\');

            if (knowledgeIndex >= 0) {
              // 找到知识库路径，提取后面的部分
              let afterKnowledge = img.substring(knowledgeIndex);
              // 移除开头的知识库部分
              afterKnowledge = afterKnowledge.replace(/^[\/\\]?知识库[\/\\]/, '').replace(/\\/g, '/');
              sourcePath = path.join(knowledgeDir, afterKnowledge);
            } else {
              // 假设是相对于知识库的路径（如 "产品资料/xxx"）
              sourcePath = path.join(knowledgeDir, img.replace(/\\/g, '/'));
            }
          }

          // 目标路径
          const targetPath = path.join(uploadsDir, targetFileName);

          logger.info('📋 复制知识库图片:');
          logger.info('  源路径:', sourcePath);
          logger.info('  目标路径:', targetPath);

          // 检查源文件是否存在
          if (!fs.existsSync(sourcePath)) {
            logger.error('❌ 源文件不存在:', sourcePath);
            return res.status(400).json({
              success: false,
              error: `图片文件不存在: ${img}`,
            });
          }

          // 复制文件
          fs.copyFileSync(sourcePath, targetPath);
          logger.info('✅ 图片复制成功');

          // 使用相对路径（相对于项目根目录）
          processedImages.push(`/uploads/images/${targetFileName}`);
        } catch (error) {
          logger.error('❌ 复制图片失败:', error);
          return res.status(500).json({
            success: false,
            error: `复制图片失败: ${error.message}`,
          });
        }
      } else {
        // 非知识库图片，直接使用
        processedImages.push(img);
      }
    }

    logger.info('🖼️ 原始图片路径:', images);
    logger.info('🔄 处理后图片路径:', processedImages);

    // 解析标签
    let tags = [];
    try {
      tags = JSON.parse(post.tags || '[]');
    } catch (e) {
      tags = [];
    }

    // 调用多账户发布服务
    const publishStartTime = Date.now();
    const result = await multiAccountPublishService.publishNote(
      post.title,
      post.content,
      processedImages,
      targetAccount.id
    );
    const publishDuration = Date.now() - publishStartTime;

    // 检查发布结果
    const isActualError = result.data && result.data.raw && result.data.raw.isError;
    const hasNoteId = result.data && result.data.note_id;
    const isPublished = result.data &&
      (result.data.status === '发布完成' || result.data.status === 'published');

    // 如果明确失败或者既没有note_id也没有发布完成状态，则视为失败
    if (!result.success || isActualError || (!hasNoteId && !isPublished)) {
      // 记录账号使用失败
      accountService.logAccountUsage(
        targetAccount.id,
        'publish',
        id,
        false,
        result.data?.message || result.error || '发布失败'
      );

      // 记录失败 - 使用增强的历史服务
      publishHistoryService.recordAttempt({
        post_id: id,
        platform: 'xiaohongshu',
        status: 'failed',
        duration_ms: publishDuration,
        error_message: result.data?.message || result.error || '发布失败',
        error_details: JSON.stringify(result),
        response: JSON.stringify(result),
        images_count: processedImages.length,
        content_length: post.content ? post.content.length : 0
      });

      return res.status(500).json({
        success: false,
        error: result.data?.message || result.error || '发布失败',
        errorDetails: result,
      });
    }

    // 记录账号使用成功
    accountService.logAccountUsage(targetAccount.id, 'publish', id, true, null);

    // 更新文案状态
    const updateStmt = db.prepare(`
      UPDATE posts
      SET status = 'published',
          xiaohongshu_id = ?,
          published_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(result.data.note_id || '', id);

    // 记录发布历史 - 使用增强的历史服务
    publishHistoryService.recordAttempt({
      post_id: id,
      platform: 'xiaohongshu',
      status: 'success',
      xiaohongshu_id: result.data.note_id || '',
      note_url: result.data.note_url || '',
      duration_ms: publishDuration,
      response: JSON.stringify(result.data),
      images_count: processedImages.length,
      content_length: post.content ? post.content.length : 0
    });

    res.json({
      success: true,
      data: {
        ...result.data,
        account_name: targetAccount.account_name, // 返回使用的账号名称
        account_id: targetAccount.id,
      },
    });
  } catch (error) {
    logger.error('发布到小红书失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 更新文案
 */
export function updatePost(req, res) {
  try {
    const { id } = req.params;
    const { title, content, images, tags } = req.body;

    const stmt = db.prepare(`
      UPDATE posts
      SET title = ?, content = ?, images = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(
      title,
      content,
      JSON.stringify(images || []),
      JSON.stringify(tags || []),
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '文案不存在',
      });
    }

    res.json({
      success: true,
    });
  } catch (error) {
    logger.error('更新文案失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 删除文案
 */
export function deletePost(req, res) {
  try {
    const { id } = req.params;

    const stmt = db.prepare('DELETE FROM posts WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '文案不存在',
      });
    }

    res.json({
      success: true,
    });
  } catch (error) {
    logger.error('删除文案失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 语法检查
 */
export async function checkGrammar(req, res) {
  try {
    const { text, mode = 'full', model = 'deepseek-chat' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: '请提供要检查的文本',
      });
    }

    logger.info(`🔍 开始语法检查（模式: ${mode}）`);

    let result;
    if (mode === 'quick') {
      // 快速检查（仅规则+统计）
      result = await grammarCheckService.quickCheck(text);
    } else {
      // 完整检查（规则+统计+AI）
      result = await grammarCheckService.checkGrammar(text, {
        enableRuleCheck: true,
        enableStatisticalCheck: true,
        enableAICheck: true,
        model: model
      });
    }

    res.json(result);
  } catch (error) {
    logger.error('语法检查失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
