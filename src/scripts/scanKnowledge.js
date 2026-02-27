import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import db from '../models/database.js';
import { parseFile } from '../utils/fileParser.js';

dotenv.config();

const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH;

if (!knowledgeBasePath) {
  console.error('请在.env文件中配置KNOWLEDGE_BASE_PATH');
  process.exit(1);
}

if (!fs.existsSync(knowledgeBasePath)) {
  console.error('知识库路径不存在:', knowledgeBasePath);
  process.exit(1);
}

console.log('开始扫描知识库:', knowledgeBasePath);

const results = {
  total: 0,
  success: 0,
  failed: 0,
  errors: [],
};

async function scanDirectory(dirPath, category = '') {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      console.log(`扫描文件夹: ${file}`);
      await scanDirectory(filePath, file);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (['.docx', '.pdf', '.xlsx', '.txt', '.pptx'].includes(ext)) {
        results.total++;
        console.log(`处理文件: ${file}`);

        try {
          let content = '';
          let parseSuccess = false;

          // 对于PPT文件，暂时跳过解析，只记录文件信息
          if (ext === '.pptx') {
            content = `PowerPoint演示文稿: ${file}`;
            parseSuccess = true;
          } else {
            const parseResult = await parseFile(filePath);
            parseSuccess = parseResult.success;

            if (parseResult.success) {
              if (parseResult.text) {
                content = parseResult.text;
              } else if (parseResult.sheets) {
                content = JSON.stringify(parseResult.sheets);
              }
            }
          }

          if (parseSuccess) {
            const stmt = db.prepare(`
              INSERT OR REPLACE INTO knowledge_docs (title, content, file_path, file_type, category)
              VALUES (?, ?, ?, ?, ?)
            `);

            stmt.run(
              path.basename(file, ext),
              content.substring(0, 50000),
              filePath,
              ext.substring(1),
              category
            );

            results.success++;
            console.log(`  ✓ 成功`);
          } else {
            results.failed++;
            results.errors.push({
              file: filePath,
              error: '解析失败',
            });
            console.log(`  ✗ 失败`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            file: filePath,
            error: error.message,
          });
          console.log(`  ✗ 错误: ${error.message}`);
        }
      }
    }
  }
}

async function main() {
  await scanDirectory(knowledgeBasePath);

  console.log('\n扫描完成:');
  console.log(`  总文件数: ${results.total}`);
  console.log(`  成功: ${results.success}`);
  console.log(`  失败: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n失败的文件:');
    results.errors.forEach(err => {
      console.log(`  - ${err.file}: ${err.error}`);
    });
  }

  process.exit(0);
}

main().catch(err => {
  console.error('扫描失败:', err);
  process.exit(1);
});
