import crypto from 'crypto';
import logger from '../utils/logger.js';
import db from '../models/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LicenseController {
  constructor() {
    this.keysDir = path.join(__dirname, '../../keys');
    this.privateKeyPath = path.join(this.keysDir, 'private.pem');
    this.publicKeyPath = path.join(this.keysDir, 'public.pem');

    // 确保密钥目录存在
    if (!fs.existsSync(this.keysDir)) {
      fs.mkdirSync(this.keysDir, { recursive: true });
    }

    // 初始化密钥对
    this.initializeKeys();
  }

  // 初始化RSA密钥对
  initializeKeys() {
    if (!fs.existsSync(this.privateKeyPath) || !fs.existsSync(this.publicKeyPath)) {
      logger.info('生成RSA密钥对...');
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      fs.writeFileSync(this.privateKeyPath, privateKey);
      fs.writeFileSync(this.publicKeyPath, publicKey);
      logger.info('✅ RSA密钥对生成完成');
    }
  }

  // 获取私钥
  getPrivateKey() {
    return fs.readFileSync(this.privateKeyPath, 'utf8');
  }

  // 获取公钥
  getPublicKey() {
    return fs.readFileSync(this.publicKeyPath, 'utf8');
  }

  // 生成许可证签名
  generateSignature(data) {
    const privateKey = this.getPrivateKey();
    const sign = crypto.createSign('SHA256');
    sign.update(JSON.stringify(data));
    sign.end();
    return sign.sign(privateKey, 'base64');
  }

  // 验证许可证签名
  verifySignature(data, signature) {
    try {
      const publicKey = this.getPublicKey();
      const verify = crypto.createVerify('SHA256');
      verify.update(JSON.stringify(data));
      verify.end();
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      logger.error('签名验证失败:', error);
      return false;
    }
  }

  // 创建许可证（管理员）
  create(req, res) {
    try {
      const {
        clientId,
        type = 'standard',
        maxClients = 1,
        features = [],
        expiresAt
      } = req.body;

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Client ID is required'
        });
      }

      // 生成许可证密钥
      const licenseKey = crypto.randomBytes(16).toString('hex');

      // 许可证数据
      const licenseData = {
        licenseKey,
        clientId,
        type,
        maxClients,
        features,
        issuedAt: new Date().toISOString(),
        expiresAt: expiresAt || null
      };

      // 生成签名
      const signature = this.generateSignature(licenseData);

      // 保存到数据库
      db.prepare(`
        INSERT INTO licenses (
          license_key, client_id, type, max_clients, features,
          issued_at, expires_at, signature, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(
        licenseKey,
        clientId,
        type,
        maxClients,
        JSON.stringify(features),
        licenseData.issuedAt,
        expiresAt || null,
        signature
      );

      logger.info(`许可证已创建: ${licenseKey} for ${clientId}`);

      res.json({
        success: true,
        data: {
          ...licenseData,
          signature
        }
      });
    } catch (error) {
      logger.error('创建许可证失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create license'
      });
    }
  }

  // 验证许可证
  verify(req, res) {
    try {
      const { licenseKey, clientId } = req.body;

      if (!licenseKey) {
        return res.status(400).json({
          success: false,
          error: 'License key is required'
        });
      }

      // 从数据库获取许可证
      const license = db.prepare(`
        SELECT * FROM licenses WHERE license_key = ?
      `).get(licenseKey);

      if (!license) {
        return res.json({
          success: false,
          valid: false,
          error: 'License not found'
        });
      }

      // 检查许可证状态
      if (license.status !== 'active') {
        return res.json({
          success: false,
          valid: false,
          error: 'License is not active'
        });
      }

      // 检查是否过期
      if (license.expires_at) {
        const expiresAt = new Date(license.expires_at);
        if (expiresAt < new Date()) {
          return res.json({
            success: false,
            valid: false,
            error: 'License has expired'
          });
        }
      }

      // 如果提供了clientId，验证是否匹配
      if (clientId && license.client_id !== clientId) {
        return res.json({
          success: false,
          valid: false,
          error: 'License does not match client ID'
        });
      }

      // 验证签名
      const licenseData = {
        licenseKey: license.license_key,
        clientId: license.client_id,
        type: license.type,
        maxClients: license.max_clients,
        features: JSON.parse(license.features || '[]'),
        issuedAt: license.issued_at,
        expiresAt: license.expires_at
      };

      const isValid = this.verifySignature(licenseData, license.signature);

      if (!isValid) {
        return res.json({
          success: false,
          valid: false,
          error: 'Invalid license signature'
        });
      }

      // 更新最后验证时间
      db.prepare(`
        UPDATE licenses SET last_verified = datetime('now') WHERE license_key = ?
      `).run(licenseKey);

      res.json({
        success: true,
        valid: true,
        data: {
          type: license.type,
          maxClients: license.max_clients,
          features: JSON.parse(license.features || '[]'),
          expiresAt: license.expires_at
        }
      });
    } catch (error) {
      logger.error('验证许可证失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify license'
      });
    }
  }

  // 获取许可证信息（管理员）
  get(req, res) {
    try {
      const { licenseKey } = req.params;

      const license = db.prepare(`
        SELECT * FROM licenses WHERE license_key = ?
      `).get(licenseKey);

      if (!license) {
        return res.status(404).json({
          success: false,
          error: 'License not found'
        });
      }

      res.json({
        success: true,
        data: {
          licenseKey: license.license_key,
          clientId: license.client_id,
          type: license.type,
          maxClients: license.max_clients,
          features: JSON.parse(license.features || '[]'),
          issuedAt: license.issued_at,
          expiresAt: license.expires_at,
          status: license.status,
          lastVerified: license.last_verified
        }
      });
    } catch (error) {
      logger.error('获取许可证失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get license'
      });
    }
  }

  // 更新许可证（管理员）
  update(req, res) {
    try {
      const { licenseKey } = req.params;
      const { status, expiresAt } = req.body;

      const license = db.prepare('SELECT id FROM licenses WHERE license_key = ?').get(licenseKey);
      if (!license) {
        return res.status(404).json({
          success: false,
          error: 'License not found'
        });
      }

      db.prepare(`
        UPDATE licenses SET status = ?, expires_at = ? WHERE license_key = ?
      `).run(status, expiresAt || null, licenseKey);

      logger.info(`许可证已更新: ${licenseKey}`);

      res.json({
        success: true,
        message: 'License updated successfully'
      });
    } catch (error) {
      logger.error('更新许可证失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update license'
      });
    }
  }

  // 获取公钥
  getPublicKeyEndpoint(req, res) {
    try {
      const publicKey = this.getPublicKey();
      res.json({
        success: true,
        data: {
          publicKey
        }
      });
    } catch (error) {
      logger.error('获取公钥失败:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get public key'
      });
    }
  }
}

export default new LicenseController();
