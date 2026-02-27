import db from '../models/database.js';
import { normalizePathForLike } from '../utils/pathUtils.js';
import fs from 'fs';
import path from 'path';

/**
 * 自动扫描产品资料文件夹并创建产品
 */
export async function autoScanProducts(req, res) {
  try {
    const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH;
    const productFolder = path.join(knowledgeBasePath, '产品资料');

    if (!fs.existsSync(productFolder)) {
      return res.status(400).json({
        success: false,
        error: '产品资料文件夹不存在',
      });
    }

    console.log(`📂 开始扫描产品: ${productFolder}`);

    // ⚠️ 关键修复：扫描前先清理不属于当前知识库的旧产品
    try {
      const pathPattern = normalizePathForLike(knowledgeBasePath);

      // 1. 先获取要删除的旧产品ID
      const oldProductsStmt = db.prepare('SELECT id FROM products WHERE folder_path NOT LIKE ? AND folder_path != ?');
      const oldProducts = oldProductsStmt.all(`${pathPattern}%`, knowledgeBasePath);
      const oldProductIds = oldProducts.map(p => p.id);

      if (oldProductIds.length > 0) {
        // 2. 删除关联到旧产品的文案（必须在删除产品之前）
        const deletePostsStmt = db.prepare(`DELETE FROM posts WHERE product_id IN (${oldProductIds.join(',')})`);
        const postsResult = deletePostsStmt.run();
        if (postsResult.changes > 0) {
          console.log(`🗑️  已清理 ${postsResult.changes} 个关联文案`);
        }

        // 3. 删除旧产品（product_images会自动级联删除）
        const deleteStmt = db.prepare('DELETE FROM products WHERE folder_path NOT LIKE ? AND folder_path != ?');
        const deleteResult = deleteStmt.run(`${pathPattern}%`, knowledgeBasePath);

        if (deleteResult.changes > 0) {
          console.log(`🗑️  已清理 ${deleteResult.changes} 个不属于当前知识库的旧产品`);
        }
      }
    } catch (cleanupError) {
      console.error('清理旧产品失败:', cleanupError);
      // 继续扫描，不因清理失败而中断
    }

    const results = {
      total: 0,
      created: 0,
      skipped: 0,
      products: [],
    };

    // 获取或创建默认分类
    let categoryStmt = db.prepare('SELECT id FROM categories WHERE name = ?');
    let category = categoryStmt.get('保健品');

    if (!category) {
      const insertStmt = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
      const result = insertStmt.run('保健品', '健康保健类产品');
      category = { id: result.lastInsertRowid };
    }

    // 读取产品资料文件夹
    const folders = fs.readdirSync(productFolder);

    for (const folder of folders) {
      const folderPath = path.join(productFolder, folder);
      const stat = fs.statSync(folderPath);

      // 只处理文件夹
      if (stat.isDirectory()) {
        results.total++;

        // 检查产品是否已存在
        const existingStmt = db.prepare('SELECT id FROM products WHERE name = ? OR folder_path = ?');
        const existing = existingStmt.get(folder, folderPath);

        if (existing) {
          results.skipped++;
          continue;
        }

        // 扫描文件夹获取产品信息
        const files = fs.readdirSync(folderPath);
        const docFiles = files.filter(f => ['.docx', '.pdf', '.txt'].includes(path.extname(f).toLowerCase()));
        const imageFiles = files.filter(f => ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(f).toLowerCase()));

        // 创建产品
        const insertProductStmt = db.prepare(`
          INSERT INTO products (name, category_id, description, folder_path)
          VALUES (?, ?, ?, ?)
        `);

        const productResult = insertProductStmt.run(
          folder,
          category.id,
          `${folder} - 从产品资料自动创建`,
          folderPath
        );

        const productId = productResult.lastInsertRowid;

        // 导入图片
        let imageCount = 0;
        files.forEach((file, index) => {
          const ext = path.extname(file).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            const filePath = path.join(folderPath, file);

            // 判断是否为主图
            let imageType = 'detail';
            if (file.includes('主图') || file.includes('main')) {
              imageType = 'main';
            }

            const insertImageStmt = db.prepare(`
              INSERT INTO product_images (product_id, file_path, file_name, image_type, sort_order)
              VALUES (?, ?, ?, ?, ?)
            `);

            insertImageStmt.run(productId, filePath, file, imageType, index);
            imageCount++;
          }
        });

        results.created++;
        results.products.push({
          id: productId,
          name: folder,
          docs: docFiles.length,
          images: imageCount,
        });
      }
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('自动扫描产品失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 获取知识库分类树结构
 */
export function getKnowledgeCategories(req, res) {
  try {
    // 一次性获取所有分类及其文档数量（优化性能）
    const stmt = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM knowledge_docs
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY category
    `);
    const categoriesWithCount = stmt.all();

    // 构建分类树
    const categoryTree = {};
    const pathCounts = {};

    // 先统计所有路径的文档数
    categoriesWithCount.forEach(({ category, count }) => {
      pathCounts[category] = count;
    });

    // 构建树结构
    categoriesWithCount.forEach(({ category }) => {
      const parts = category.split('/');
      let current = categoryTree;

      parts.forEach((part, index) => {
        if (!current[part]) {
          const currentPath = parts.slice(0, index + 1).join('/');
          current[part] = {
            name: part,
            path: currentPath,
            children: {},
            count: pathCounts[currentPath] || 0,
          };
        }

        current = current[part].children;
      });
    });

    res.json({
      success: true,
      data: categoryTree,
    });
  } catch (error) {
    console.error('获取分类树失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
