import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Docling文档解析服务
 * 使用Python subprocess调用docling库解析文档
 */
class DoclingService {
  constructor() {
    this.pythonScript = path.join(__dirname, '../../scripts/docling_parser.py');
  }

  /**
   * 解析文档
   * @param {string} filePath - 文档文件路径
   * @param {boolean} enableOcr - 是否启用OCR（默认true）
   * @returns {Promise<Object>} 解析结果
   */
  async parseDocument(filePath, enableOcr = true) {
    return new Promise((resolve, reject) => {
      const args = [this.pythonScript, filePath];
      if (!enableOcr) {
        args.push('no-ocr');
      }

      logger.info(`🔍 开始解析文档: ${filePath}`);
      logger.info(`📝 OCR状态: ${enableOcr ? '启用' : '禁用'}`);

      const python = spawn('python', args);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          logger.error(`❌ Python进程退出，代码: ${code}`);
          logger.error(`错误输出: ${stderr}`);
          reject(new Error(`Python进程失败: ${stderr || '未知错误'}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);

          if (result.success) {
            logger.info(`✅ 文档解析成功: ${filePath}`);
            logger.info(`📊 字符数: ${result.metadata?.char_count || 0}`);
            logger.info(`📄 页数: ${result.metadata?.page_count || 0}`);
          } else {
            logger.error(`❌ 文档解析失败: ${result.error}`);
          }

          resolve(result);
        } catch (error) {
          logger.error(`❌ 解析JSON输出失败: ${error.message}`);
          logger.error(`原始输出: ${stdout}`);
          reject(new Error(`解析JSON失败: ${error.message}`));
        }
      });

      python.on('error', (error) => {
        logger.error(`❌ 启动Python进程失败: ${error.message}`);
        reject(new Error(`启动Python失败: ${error.message}`));
      });
    });
  }

  /**
   * 检查文档格式是否支持
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否支持
   */
  isSupportedFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const supportedFormats = [
      '.pdf', '.docx', '.doc', '.pptx', '.ppt',
      '.xlsx', '.xls', '.jpg', '.jpeg', '.png',
      '.gif', '.bmp', '.tiff', '.tif'
    ];
    return supportedFormats.includes(ext);
  }

  /**
   * 批量解析文档
   * @param {Array<string>} filePaths - 文件路径数组
   * @param {boolean} enableOcr - 是否启用OCR
   * @returns {Promise<Array<Object>>} 解析结果数组
   */
  async parseDocuments(filePaths, enableOcr = true) {
    logger.info(`📚 开始批量解析 ${filePaths.length} 个文档`);

    const results = [];
    for (const filePath of filePaths) {
      try {
        const result = await this.parseDocument(filePath, enableOcr);
        results.push({
          filePath,
          ...result
        });
      } catch (error) {
        logger.error(`❌ 解析文档失败 ${filePath}: ${error.message}`);
        results.push({
          filePath,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`✅ 批量解析完成: ${successCount}/${filePaths.length} 成功`);

    return results;
  }
}

export default new DoclingService();
