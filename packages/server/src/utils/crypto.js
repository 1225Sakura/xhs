import crypto from 'crypto';

// 加密工具类 - 用于AI提供商API密钥的安全存储

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * 获取加密密钥
 * 从环境变量ENCRYPTION_KEY获取，必须是32字节
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY环境变量未设置');
  }

  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY必须是32个字符');
  }

  return key;
}

/**
 * 加密文本
 * @param {string} text - 要加密的明文
 * @returns {string} - 加密后的文本（格式: iv:encryptedData）
 */
export function encrypt(text) {
  if (!text) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 返回格式: iv:encryptedData
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('❌ 加密失败:', error.message);
    throw new Error(`加密失败: ${error.message}`);
  }
}

/**
 * 解密文本
 * @param {string} encryptedText - 加密的文本（格式: iv:encryptedData）
 * @returns {string} - 解密后的明文
 */
export function decrypt(encryptedText) {
  if (!encryptedText) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');

    if (parts.length !== 2) {
      throw new Error('加密文本格式无效');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), iv);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('❌ 解密失败:', error.message);
    throw new Error(`解密失败: ${error.message}`);
  }
}

/**
 * 生成随机的32字符密钥（用于初始化）
 * @returns {string} - 32字符的随机密钥
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 掩码显示敏感信息（用于日志）
 * @param {string} text - 敏感文本
 * @param {number} visibleChars - 可见字符数（默认8）
 * @returns {string} - 掩码后的文本
 */
export function maskSensitive(text, visibleChars = 8) {
  if (!text) {
    return '';
  }

  if (text.length <= visibleChars) {
    return '*'.repeat(text.length);
  }

  const visible = text.substring(0, visibleChars);
  const masked = '*'.repeat(text.length - visibleChars);

  return visible + masked;
}

export default {
  encrypt,
  decrypt,
  generateEncryptionKey,
  maskSensitive
};
