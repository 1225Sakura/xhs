import db from '../models/database.js';
import logger from '../utils/logger.js';
import { parseFile } from '../utils/fileParser.js';
import { normalizePathForLike } from '../utils/pathUtils.js';
import doclingService from '../services/doclingService.js';
import fs from 'fs';
import path from 'path';

/**
 * 获取所有知识文档
 */
export function getAllDocs(req, res) {
  try {
    const { category, search } = req.query;
    const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH;

    logger.info('📚 获取知识库文档请求');
    logger.info('  知识库路径:', knowledgeBasePath || '(未配置)');
    logger.info('  分类过滤:', category || '(无)');
    logger.info('  搜索关键词:', search || '(无)');

    // 如果没有配置知识库路径，返回空列表
    if (!knowledgeBasePath) {
      logger.warn('⚠️  未配置知识库路径，返回空列表');
      return res.json({
        success: true,
        data: [],
        message: '未配置知识库路径',
      });
    }

    let query = 'SELECT * FROM knowledge_docs WHERE 1=1';
    const params = [];

    // 只返回当前知识库路径下的文档
    // 使用规范化路径确保完全匹配，避免 "知识库" 匹配到 "知识库p"
    const pathPattern = normalizePathForLike(knowledgeBasePath);

    logger.info('  规范化路径模式:', pathPattern);
    logger.info('  SQL查询参数:', `${pathPattern}%`, knowledgeBasePath);

    query += ' AND (file_path LIKE ? OR file_path = ?)';
    params.push(`${pathPattern}%`, knowledgeBasePath);

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    logger.info('  执行SQL:', query);
    logger.info('  参数:', params);

    const stmt = db.prepare(query);
    const docs = stmt.all(...params);

    logger.info(`✅ 找到 ${docs.length} 个文档`);
    if (docs.length > 0) {
      logger.info('  示例文档路径:', docs[0].file_path);
    }

    res.json({
      success: true,
      data: docs,
    });
  } catch (error) {
    logger.error('获取文档失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 获取单个文档详情
 */
export function getDocById(req, res) {
  try {
    const { id } = req.params;
    const stmt = db.prepare('SELECT * FROM knowledge_docs WHERE id = ?');
    const doc = stmt.get(id);

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: '文档不存在',
      });
    }

    res.json({
      success: true,
      data: doc,
    });
  } catch (error) {
    logger.error('获取文档详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 扫描知识库文件夹
 */
export async function scanKnowledgeBase(req, res) {
  try {
    const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH;

    if (!knowledgeBasePath || !fs.existsSync(knowledgeBasePath)) {
      return res.status(400).json({
        success: false,
        error: '知识库路径未配置或不存在',
      });
    }

    logger.info(`📂 开始扫描知识库: ${knowledgeBasePath}`);

    // ⚠️ 关键修复：扫描前先清理不属于当前知识库的旧文档
    try {
      const pathPattern = normalizePathForLike(knowledgeBasePath);
      const deleteStmt = db.prepare(
        'DELETE FROM knowledge_docs WHERE file_path NOT LIKE ? AND file_path != ?'
      );
      const deleteResult = deleteStmt.run(`${pathPattern}%`, knowledgeBasePath);

      if (deleteResult.changes > 0) {
        logger.info(`🗑️  已清理 ${deleteResult.changes} 个不属于当前知识库的旧文档`);
      }
    } catch (cleanupError) {
      logger.error('清理旧文档失败:', cleanupError);
      // 继续扫描，不因清理失败而中断
    }

    const results = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [],
      cleaned: 0, // 记录清理的旧文档数量
    };

    // 递归扫描文件夹
    async function scanDirectory(dirPath, category = '') {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          // 递归扫描子文件夹
          await scanDirectory(filePath, file);
        } else {
          const ext = path.extname(file).toLowerCase();
          // 支持的文档格式（不包括图片，图片在产品管理中查看）
          const supportedFormats = ['.docx', '.pdf', '.xlsx', '.txt', '.pptx', '.doc', '.xls', '.ppt'];

          if (supportedFormats.includes(ext)) {
            results.total++;

            try {
              // 验证文件路径是否在当前知识库内
              if (!filePath.startsWith(knowledgeBasePath)) {
                logger.warn(`⚠️  跳过不在知识库路径内的文件: ${filePath}`);
                results.failed++;
                results.errors.push({
                  file: filePath,
                  error: '文件不在当前知识库路径内',
                });
                continue;
              }

              // 优先使用docling解析（支持OCR和更多格式）
              let parseResult;
              const useDocling = doclingService.isSupportedFormat(filePath);

              if (useDocling) {
                logger.info(`📄 使用Docling解析: ${file}`);
                parseResult = await doclingService.parseDocument(filePath, true); // 启用OCR

                if (parseResult.success) {
                  parseResult.text = parseResult.content; // 统一接口
                }
              } else {
                // 回退到旧的解析器
                logger.info(`📄 使用传统解析器: ${file}`);
                parseResult = await parseFile(filePath);
              }

              if (parseResult.success) {
                let content = '';
                if (parseResult.text) {
                  content = parseResult.text;
                } else if (parseResult.sheets) {
                  content = JSON.stringify(parseResult.sheets);
                }

                // 存入数据库
                const stmt = db.prepare(`
                  INSERT OR REPLACE INTO knowledge_docs (title, content, file_path, file_type, category)
                  VALUES (?, ?, ?, ?, ?)
                `);

                stmt.run(
                  path.basename(file, ext),
                  content.substring(0, 50000), // 限制长度
                  filePath,
                  ext.substring(1),
                  category
                );

                results.success++;
              } else {
                results.failed++;
                results.errors.push({
                  file: filePath,
                  error: parseResult.error,
                });
              }
            } catch (error) {
              results.failed++;
              results.errors.push({
                file: filePath,
                error: error.message,
              });
            }
          }
        }
      }
    }

    await scanDirectory(knowledgeBasePath);

    logger.info(`✅ 扫描完成: 成功 ${results.success}, 失败 ${results.failed}`);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('扫描知识库失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 添加文档
 */
export async function addDoc(req, res) {
  try {
    const { title, content, category, tags } = req.body;
    const file = req.file;

    if (!file && !content) {
      return res.status(400).json({
        success: false,
        error: '请提供文件或内容',
      });
    }

    let docContent = content;
    let filePath = '';
    let fileType = 'text';

    if (file) {
      filePath = file.path;
      fileType = path.extname(file.originalname).substring(1);

      // 解析文件
      const parseResult = await parseFile(filePath);
      if (parseResult.success) {
        if (parseResult.text) {
          docContent = parseResult.text;
        } else if (parseResult.sheets) {
          docContent = JSON.stringify(parseResult.sheets);
        }
      }
    }

    const stmt = db.prepare(`
      INSERT INTO knowledge_docs (title, content, file_path, file_type, category, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title,
      docContent,
      filePath,
      fileType,
      category || '',
      tags ? JSON.stringify(tags) : '[]'
    );

    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
      },
    });
  } catch (error) {
    logger.error('添加文档失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 删除文档
 */
export function deleteDoc(req, res) {
  try {
    const { id } = req.params;

    const stmt = db.prepare('DELETE FROM knowledge_docs WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '文档不存在',
      });
    }

    res.json({
      success: true,
    });
  } catch (error) {
    logger.error('删除文档失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 获取知识库配置
 */
export function getKnowledgeConfig(req, res) {
  try {
    const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH || '';
    const pathExists = knowledgeBasePath && fs.existsSync(knowledgeBasePath);

    res.json({
      success: true,
      data: {
        path: knowledgeBasePath,
        exists: pathExists,
      },
    });
  } catch (error) {
    logger.error('获取知识库配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 更新知识库路径
 */
export function updateKnowledgePath(req, res) {
  try {
    const { path: newPath } = req.body;

    if (!newPath) {
      return res.status(400).json({
        success: false,
        error: '请提供知识库路径',
      });
    }

    // 验证路径是否存在
    if (!fs.existsSync(newPath)) {
      return res.status(400).json({
        success: false,
        error: '指定的路径不存在',
      });
    }

    // 验证是否为目录
    const stat = fs.statSync(newPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({
        success: false,
        error: '指定的路径不是文件夹',
      });
    }

    const oldPath = process.env.KNOWLEDGE_BASE_PATH;
    let cleanupStats = {
      docs: 0,
      products: 0
    };

    // 如果路径发生变化，自动清理所有旧数据
    if (oldPath && oldPath !== newPath) {
      logger.info(`📂 知识库路径变更: ${oldPath} -> ${newPath}`);
      logger.info(`🗑️  开始清理旧数据...`);

      try {
        const pathPattern = normalizePathForLike(newPath);

        // 1. 清理旧文档
        const deleteDocsStmt = db.prepare('DELETE FROM knowledge_docs WHERE file_path NOT LIKE ? AND file_path != ?');
        const docsResult = deleteDocsStmt.run(`${pathPattern}%`, newPath);
        cleanupStats.docs = docsResult.changes;
        logger.info(`   ✅ 已清理 ${docsResult.changes} 个旧文档`);

        // 2. 先获取要删除的旧产品ID列表
        const oldProductsStmt = db.prepare('SELECT id FROM products WHERE folder_path NOT LIKE ? AND folder_path != ?');
        const oldProducts = oldProductsStmt.all(`${pathPattern}%`, newPath);
        const oldProductIds = oldProducts.map(p => p.id);

        if (oldProductIds.length > 0) {
          // 3. 删除关联到旧产品的文案（必须在删除产品之前）
          const deletePostsStmt = db.prepare(`DELETE FROM posts WHERE product_id IN (${oldProductIds.join(',')})`);
          const postsResult = deletePostsStmt.run();
          if (postsResult.changes > 0) {
            logger.info(`   ✅ 已清理 ${postsResult.changes} 个关联文案`);
          }

          // 4. 删除旧产品（product_images会自动级联删除）
          const deleteProductsStmt = db.prepare('DELETE FROM products WHERE folder_path NOT LIKE ? AND folder_path != ?');
          const productsResult = deleteProductsStmt.run(`${pathPattern}%`, newPath);
          cleanupStats.products = productsResult.changes;
          logger.info(`   ✅ 已清理 ${productsResult.changes} 个旧产品`);
        }

      } catch (deleteError) {
        logger.error('清理旧数据失败:', deleteError);
        return res.status(500).json({
          success: false,
          error: `清理旧数据失败: ${deleteError.message}`,
        });
      }
    }

    // 更新环境变量
    process.env.KNOWLEDGE_BASE_PATH = newPath;

    // 更新 .env 文件
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // 更新或添加 KNOWLEDGE_BASE_PATH
    const lines = envContent.split('\n');
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('KNOWLEDGE_BASE_PATH=')) {
        lines[i] = `KNOWLEDGE_BASE_PATH=${newPath}`;
        found = true;
        break;
      }
    }

    if (!found) {
      lines.push(`KNOWLEDGE_BASE_PATH=${newPath}`);
    }

    fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');

    logger.info(`✅ 知识库路径已更新为: ${newPath}`);

    res.json({
      success: true,
      data: {
        path: newPath,
        message: oldPath && oldPath !== newPath
          ? `知识库路径已更新，已清理 ${cleanupStats.docs} 个旧文档和 ${cleanupStats.products} 个旧产品`
          : '知识库路径已更新',
        cleanup: cleanupStats
      },
    });
  } catch (error) {
    logger.error('更新知识库路径失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 浏览文件系统目录
 */
export function browseDirectories(req, res) {
  try {
    const { path: dirPath } = req.query;
    const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH;

    // 如果没有提供路径，优先返回当前知识库路径的父目录，如果没有配置则返回根目录列表
    if (!dirPath) {
      // 如果配置了知识库路径，从其父目录开始浏览
      if (knowledgeBasePath && fs.existsSync(knowledgeBasePath)) {
        const parentPath = path.dirname(knowledgeBasePath);

        // 读取父目录内容
        try {
          const items = fs.readdirSync(parentPath)
            .filter(name => {
              try {
                const fullPath = path.join(parentPath, name);
                return fs.statSync(fullPath).isDirectory();
              } catch (e) {
                return false;
              }
            })
            .map(name => ({
              name,
              path: path.join(parentPath, name),
              isDirectory: true,
              isCurrent: path.join(parentPath, name) === knowledgeBasePath,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

          // 获取父目录的父目录
          let parentOfParent = null;
          if (process.platform === 'win32') {
            const isDriveRoot = /^[A-Z]:\\$/i.test(parentPath);
            if (isDriveRoot) {
              parentOfParent = '';
            } else {
              const parent = path.dirname(parentPath);
              if (parent !== parentPath) {
                parentOfParent = parent;
              }
            }
          } else {
            const parent = path.dirname(parentPath);
            if (parent !== parentPath) {
              parentOfParent = parent;
            }
          }

          return res.json({
            success: true,
            data: {
              current: parentPath,
              parent: parentOfParent,
              items,
              currentKnowledgeBase: knowledgeBasePath,
            },
          });
        } catch (e) {
          // 如果读取失败，继续使用默认的驱动器列表
        }
      }

      // Windows: 返回所有驱动器
      if (process.platform === 'win32') {
        const drives = [];
        for (let i = 65; i <= 90; i++) {
          const drive = String.fromCharCode(i) + ':\\';
          if (fs.existsSync(drive)) {
            drives.push({
              name: drive,
              path: drive,
              isDirectory: true,
              isRoot: true,
            });
          }
        }
        return res.json({
          success: true,
          data: {
            current: '',
            parent: null,
            items: drives,
            currentKnowledgeBase: knowledgeBasePath || null,
          },
        });
      } else {
        // Linux/Mac: 从根目录开始
        const rootPath = '/';
        const items = fs.readdirSync(rootPath)
          .filter(name => {
            try {
              const fullPath = path.join(rootPath, name);
              return fs.statSync(fullPath).isDirectory();
            } catch (e) {
              return false;
            }
          })
          .map(name => ({
            name,
            path: path.join(rootPath, name),
            isDirectory: true,
          }));

        return res.json({
          success: true,
          data: {
            current: rootPath,
            parent: null,
            items,
            currentKnowledgeBase: knowledgeBasePath || null,
          },
        });
      }
    }

    // 验证路径是否存在
    if (!fs.existsSync(dirPath)) {
      return res.status(400).json({
        success: false,
        error: '路径不存在',
      });
    }

    // 验证是否为目录
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({
        success: false,
        error: '不是有效的目录',
      });
    }

    // 读取目录内容（只返回子目录）
    const items = fs.readdirSync(dirPath)
      .filter(name => {
        try {
          const fullPath = path.join(dirPath, name);
          return fs.statSync(fullPath).isDirectory();
        } catch (e) {
          return false; // 跳过无法访问的目录
        }
      })
      .map(name => ({
        name,
        path: path.join(dirPath, name),
        isDirectory: true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // 获取父目录路径
    let parentPath = null;

    if (process.platform === 'win32') {
      // Windows: 检查是否为驱动器根目录（如 C:\）
      const isDriveRoot = /^[A-Z]:\\$/i.test(dirPath);

      if (isDriveRoot) {
        // 驱动器根目录，返回空字符串表示回到驱动器选择
        parentPath = '';
      } else {
        // 非根目录，返回父目录
        const parent = path.dirname(dirPath);
        if (parent !== dirPath) {
          parentPath = parent;
        }
      }
    } else {
      // Linux/Mac: 使用标准的 dirname
      const parent = path.dirname(dirPath);
      if (parent !== dirPath) {
        parentPath = parent;
      }
    }

    res.json({
      success: true,
      data: {
        current: dirPath,
        parent: parentPath,
        items,
        currentKnowledgeBase: process.env.KNOWLEDGE_BASE_PATH || null,
      },
    });
  } catch (error) {
    logger.error('浏览目录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 清理不属于当前知识库的文档
 */
export function cleanupOldDocs(req, res) {
  try {
    const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH;

    if (!knowledgeBasePath) {
      return res.status(400).json({
        success: false,
        error: '未配置知识库路径',
      });
    }

    // 删除不属于当前知识库路径的文档
    const pathPattern = normalizePathForLike(knowledgeBasePath);
    const deleteStmt = db.prepare('DELETE FROM knowledge_docs WHERE file_path NOT LIKE ? AND file_path != ?');
    const result = deleteStmt.run(`${pathPattern}%`, knowledgeBasePath);

    res.json({
      success: true,
      data: {
        deleted: result.changes,
        message: `已清理 ${result.changes} 个不属于当前知识库的文档`,
      },
    });
  } catch (error) {
    logger.error('清理文档失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
