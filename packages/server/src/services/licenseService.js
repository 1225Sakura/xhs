const crypto = require('crypto');
const db = require('../models/cloudDatabase');
const logger = require('../utils/logger');

class LicenseService {
  constructor() {
    // RSA密钥对（生产环境应该从环境变量或密钥管理服务获取）
    this.privateKey = process.env.LICENSE_PRIVATE_KEY || this.generateKeyPair().privateKey;
    this.publicKey = process.env.LICENSE_PUBLIC_KEY || this.generateKeyPair().publicKey;
  }

  // 生成RSA密钥对
  generateKeyPair() {
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

    return { publicKey, privateKey };
  }

  // 生成许可证密钥
  generateLicenseKey() {
    // 格式: XXXX-XXXX-XXXX-XXXX-XXXX
    const segments = [];
    for (let i = 0; i < 5; i++) {
      const segment = crypto.randomBytes(2).toString('hex').toUpperCase();
      segments.push(segment);
    }
    return segments.join('-');
  }

  // 创建许可证
  async createLicense(licenseData) {
    const {
      customerName,
      customerEmail,
      planType = 'basic',
      maxClients = 1,
      features = { ai: true, publish: true, schedule: true },
      expiresAt
    } = licenseData;

    try {
      const licenseKey = this.generateLicenseKey();

      // 创建许可证数据
      const licenseInfo = {
        licenseKey,
        customerName,
        customerEmail,
        planType,
        maxClients,
        features,
        expiresAt: expiresAt || this.getDefaultExpiry(planType),
        createdAt: new Date().toISOString()
      };

      // 生成签名
      const signature = this.signLicense(licenseInfo);
      licenseInfo.signature = signature;

      // 保存到数据库
      const result = await db.query(
        `INSERT INTO licenses (license_key, customer_name, customer_email, plan_type, max_clients, features, expires_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING *`,
        [
          licenseKey,
          customerName,
          customerEmail,
          planType,
          maxClients,
          JSON.stringify(features),
          licenseInfo.expiresAt
        ]
      );

      return {
        ...result.rows[0],
        signature
      };
    } catch (error) {
      logger.error('Failed to create license:', error);
      throw error;
    }
  }

  // 签名许可证
  signLicense(licenseInfo) {
    const data = JSON.stringify({
      licenseKey: licenseInfo.licenseKey,
      customerEmail: licenseInfo.customerEmail,
      planType: licenseInfo.planType,
      maxClients: licenseInfo.maxClients,
      features: licenseInfo.features,
      expiresAt: licenseInfo.expiresAt
    });

    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();

    return sign.sign(this.privateKey, 'base64');
  }

  // 验证许可证签名
  verifySignature(licenseInfo, signature) {
    const data = JSON.stringify({
      licenseKey: licenseInfo.licenseKey,
      customerEmail: licenseInfo.customerEmail,
      planType: licenseInfo.planType,
      maxClients: licenseInfo.maxClients,
      features: licenseInfo.features,
      expiresAt: licenseInfo.expiresAt
    });

    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();

    return verify.verify(this.publicKey, signature, 'base64');
  }

  // 验证许可证
  async verifyLicense(licenseKey, machineId) {
    try {
      // 从数据库获取许可证
      const result = await db.query(
        'SELECT * FROM licenses WHERE license_key = $1',
        [licenseKey]
      );

      if (result.rows.length === 0) {
        return {
          valid: false,
          reason: 'LICENSE_NOT_FOUND'
        };
      }

      const license = result.rows[0];

      // 检查许可证状态
      if (license.status !== 'active') {
        return {
          valid: false,
          reason: 'LICENSE_INACTIVE',
          status: license.status
        };
      }

      // 检查过期时间
      if (license.expires_at && new Date(license.expires_at) < new Date()) {
        // 更新状态为过期
        await db.query(
          `UPDATE licenses SET status = 'expired' WHERE license_key = $1`,
          [licenseKey]
        );

        return {
          valid: false,
          reason: 'LICENSE_EXPIRED',
          expiresAt: license.expires_at
        };
      }

      // 检查客户端数量限制
      const clientCount = await db.query(
        'SELECT COUNT(*) FROM clients WHERE license_key = $1',
        [licenseKey]
      );

      const currentClients = parseInt(clientCount.rows[0].count);

      // 如果是新客户端，检查是否超过限制
      const existingClient = await db.query(
        'SELECT * FROM clients WHERE license_key = $1 AND machine_id = $2',
        [licenseKey, machineId]
      );

      if (existingClient.rows.length === 0 && currentClients >= license.max_clients) {
        return {
          valid: false,
          reason: 'MAX_CLIENTS_REACHED',
          maxClients: license.max_clients,
          currentClients
        };
      }

      return {
        valid: true,
        license: {
          licenseKey: license.license_key,
          planType: license.plan_type,
          features: license.features,
          expiresAt: license.expires_at,
          maxClients: license.max_clients,
          currentClients
        }
      };
    } catch (error) {
      logger.error('Failed to verify license:', error);
      throw error;
    }
  }

  // 获取许可证信息
  async getLicense(licenseKey) {
    try {
      const result = await db.query(
        'SELECT * FROM licenses WHERE license_key = $1',
        [licenseKey]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get license:', error);
      throw error;
    }
  }

  // 更新许可证
  async updateLicense(licenseKey, updates) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.status) {
        fields.push(`status = $${paramIndex}`);
        values.push(updates.status);
        paramIndex++;
      }

      if (updates.expiresAt) {
        fields.push(`expires_at = $${paramIndex}`);
        values.push(updates.expiresAt);
        paramIndex++;
      }

      if (updates.maxClients !== undefined) {
        fields.push(`max_clients = $${paramIndex}`);
        values.push(updates.maxClients);
        paramIndex++;
      }

      if (updates.features) {
        fields.push(`features = $${paramIndex}`);
        values.push(JSON.stringify(updates.features));
        paramIndex++;
      }

      if (fields.length === 0) {
        return null;
      }

      values.push(licenseKey);

      const result = await db.query(
        `UPDATE licenses SET ${fields.join(', ')} WHERE license_key = $${paramIndex} RETURNING *`,
        values
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update license:', error);
      throw error;
    }
  }

  // 获取默认过期时间
  getDefaultExpiry(planType) {
    const now = new Date();
    switch (planType) {
      case 'trial':
        return new Date(now.setDate(now.getDate() + 30)); // 30天试用
      case 'basic':
        return new Date(now.setFullYear(now.getFullYear() + 1)); // 1年
      case 'pro':
        return new Date(now.setFullYear(now.getFullYear() + 1)); // 1年
      case 'enterprise':
        return new Date(now.setFullYear(now.getFullYear() + 3)); // 3年
      default:
        return new Date(now.setFullYear(now.getFullYear() + 1)); // 默认1年
    }
  }

  // 获取公钥（供客户端验证使用）
  getPublicKey() {
    return this.publicKey;
  }
}

module.exports = new LicenseService();
