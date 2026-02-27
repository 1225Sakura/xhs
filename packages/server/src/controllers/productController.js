import db from '../models/database.js';
import fs from 'fs';
import path from 'path';

/**
 * 获取所有产品
 */
export function getAllProducts(req, res) {
  try {
    const { category } = req.query;
    let query = `
      SELECT p.*, c.name as category_name,
             (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) as image_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND c.name = ?';
      params.push(category);
    }

    query += ' ORDER BY p.created_at DESC';

    const stmt = db.prepare(query);
    const products = stmt.all(...params);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('获取产品列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 获取产品详情（包含图片）
 */
export function getProductById(req, res) {
  try {
    const { id } = req.params;

    // 获取产品基本信息
    const productStmt = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `);
    const product = productStmt.get(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: '产品不存在',
      });
    }

    // 获取产品图片
    const imagesStmt = db.prepare(`
      SELECT * FROM product_images
      WHERE product_id = ?
      ORDER BY sort_order, created_at
    `);
    const images = imagesStmt.all(id);

    // 转换图片路径为可访问的URL
    const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH;
    product.images = images.map(img => {
      let url = '';

      // 如果有知识库路径配置，提取相对路径
      if (knowledgeBasePath && img.file_path.startsWith(knowledgeBasePath)) {
        // 提取相对路径（移除知识库基础路径）
        let relativePath = img.file_path.substring(knowledgeBasePath.length);
        // 移除开头���路径分隔符
        relativePath = relativePath.replace(/^[\\\/]+/, '');
        // 转换为URL格式
        url = `/knowledge/${relativePath.replace(/\\/g, '/')}`;
      } else {
        // 如果没有配置或路径不匹配，尝试查找知识库标记
        const normalizedPath = img.file_path.replace(/\\/g, '/');
        const knowledgeMarkers = ['知识库', 'knowledge', 'docs', 'documents'];

        for (const marker of knowledgeMarkers) {
          const markerIndex = normalizedPath.indexOf(marker);
          if (markerIndex !== -1) {
            // 找到标记所在目录的结束位置
            let endIndex = markerIndex;
            while (endIndex < normalizedPath.length && normalizedPath[endIndex] !== '/') {
              endIndex++;
            }
            // 提取标记目录之后的路径
            if (endIndex < normalizedPath.length) {
              const relativePath = normalizedPath.substring(endIndex + 1);
              url = `/knowledge/${relativePath}`;
              break;
            }
          }
        }
      }

      return {
        ...img,
        url: url || img.file_path,  // 如果无法生成URL，使用原始路径
      };
    });

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('获取产品详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 创建产品
 */
export function createProduct(req, res) {
  try {
    const { name, category_id, description, features, benefits, usage, folder_path } = req.body;

    const stmt = db.prepare(`
      INSERT INTO products (name, category_id, description, features, benefits, usage, folder_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(name, category_id, description, features, benefits, usage, folder_path);

    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
      },
    });
  } catch (error) {
    console.error('创建产品失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 更新产品
 */
export function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const { name, category_id, description, features, benefits, usage } = req.body;

    const stmt = db.prepare(`
      UPDATE products
      SET name = ?, category_id = ?, description = ?, features = ?, benefits = ?, usage = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(name, category_id, description, features, benefits, usage, id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '产品不存在',
      });
    }

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('更新产品失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 删除产品
 */
export function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    const stmt = db.prepare('DELETE FROM products WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '产品不存在',
      });
    }

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('删除产品失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 扫描产品文件夹并导入图片
 */
export function scanProductImages(req, res) {
  try {
    const { id } = req.params;

    // 获取产品信息
    const productStmt = db.prepare('SELECT * FROM products WHERE id = ?');
    const product = productStmt.get(id);

    if (!product || !product.folder_path) {
      return res.status(404).json({
        success: false,
        error: '产品不存在或未设置文件夹路径',
      });
    }

    if (!fs.existsSync(product.folder_path)) {
      return res.status(400).json({
        success: false,
        error: '文件夹路径不存在',
      });
    }

    // 扫描图片文件
    const files = fs.readdirSync(product.folder_path);
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    let count = 0;

    files.forEach((file, index) => {
      const ext = path.extname(file).toLowerCase();
      if (imageExts.includes(ext)) {
        const absolutePath = path.join(product.folder_path, file);

        // 计算相对于知识库根目录的相对路径
        const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH || path.join(__dirname, '../../知识库');
        const relativePath = path.relative(knowledgeBasePath, absolutePath).replace(/\\/g, '/');

        // 判断图片类型
        let imageType = 'detail';
        if (file.includes('主图')) {
          imageType = 'main';
        }

        // 插入数据库时存储相对路径
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO product_images (product_id, file_path, file_name, image_type, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(id, relativePath, file, imageType, index);
        count++;
      }
    });

    res.json({
      success: true,
      data: {
        count: count,
      },
    });
  } catch (error) {
    console.error('扫描产品图片失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 获取所有分类
 */
export function getAllCategories(req, res) {
  try {
    const stmt = db.prepare('SELECT * FROM categories ORDER BY name');
    const categories = stmt.all();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 创建分类
 */
export function createCategory(req, res) {
  try {
    const { name, description } = req.body;

    const stmt = db.prepare(`
      INSERT INTO categories (name, description)
      VALUES (?, ?)
    `);

    const result = stmt.run(name, description);

    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
      },
    });
  } catch (error) {
    console.error('创建分类失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
