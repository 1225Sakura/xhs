/**
 * 路径处理工具函数
 */

/**
 * 规范化知识库路径用于SQL LIKE匹配
 * 确保路径以分隔符结尾，避免 "知识库" 匹配到 "知识库p"
 *
 * @param {string} basePath - 基础路径
 * @returns {string} 规范化后的路径
 */
export function normalizePathForLike(basePath) {
  if (!basePath) return '';

  // 统一使用反斜杠（Windows风格）
  const normalized = basePath.replace(/\//g, '\\');

  // 确保以路径分隔符结尾
  return normalized.endsWith('\\') ? normalized : normalized + '\\';
}
