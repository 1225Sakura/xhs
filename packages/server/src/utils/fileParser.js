import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import xlsx from 'xlsx';
import fs from 'fs';

/**
 * 解析Word文档(.docx)
 */
export async function parseDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      success: true,
      text: result.value,
      messages: result.messages
    };
  } catch (error) {
    console.error('解析DOCX文件失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 解析PDF文档
 */
export async function parsePdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return {
      success: true,
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  } catch (error) {
    console.error('解析PDF文件失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 解析Excel文档(.xlsx, .xls)
 */
export function parseExcel(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheets = {};

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      sheets[sheetName] = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
    });

    return {
      success: true,
      sheets: sheets,
      sheetNames: workbook.SheetNames
    };
  } catch (error) {
    console.error('解析Excel文件失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 解析文本文件(.txt)
 */
export function parseTxt(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    return {
      success: true,
      text: text
    };
  } catch (error) {
    console.error('解析TXT文件失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 根据文件类型自动选择解析器
 */
export async function parseFile(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();

  switch (ext) {
    case 'docx':
      return await parseDocx(filePath);
    case 'pdf':
      return await parsePdf(filePath);
    case 'xlsx':
    case 'xls':
      return parseExcel(filePath);
    case 'txt':
      return parseTxt(filePath);
    default:
      return { success: false, error: `不支持的文件类型: ${ext}` };
  }
}
