/**
import logger from '../utils/logger.js';
 * 完善的小红书登录服务
 * 结合本地 Playwright 和 MCP 服务器的优点
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class EnhancedXhsLoginService {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    // Cookies 保存到 MCP 容器的挂载目录
    this.cookiePath = path.join(process.cwd(), 'external', 'xiaohongshu-mcp', 'data', 'cookies.json');
    this.loginCheckInterval = null;
  }

  /**
   * 获取登录二维码
   */
  async getQRCode(req, res) {
    try {
      logger.info('🚀 开始获取二维码...');

      // 清理之前的浏览器实例
      await this.cleanup();

      // 启动浏览器
      logger.info('📦 正在启动 Chromium...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-blink-features=AutomationControlled'
        ]
      });
      logger.info('✅ Chromium 启动成功');

      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });
      logger.info('✅ 浏览器上下文创建成功');

      this.page = await this.context.newPage();
      logger.info('✅ 新页面创建成功');

      // 访问小红书登录页面
      logger.info('🌐 正在访问小红书登录页面...');
      try {
        await this.page.goto('https://www.xiaohongshu.com/explore', {
          waitUntil: 'domcontentloaded',  // 使用更宽松的等待条件
          timeout: 60000  // 增加超时时间
        });
        logger.info('✅ 页面加载成功');
      } catch (error) {
        logger.warn('⚠️ 页面加载超时，尝试继续...');
        // 即使超时也继续，因为页面可能已经部分加载
      }

      // 等待页面稳定
      await this.page.waitForTimeout(2000);

      // 检查是否已经登录
      const isLoggedIn = await this.checkLoginStatusOnPage();
      if (isLoggedIn) {
        logger.info('✅ 检测到已登录状态');
        await this.saveCookies();
        await this.cleanup();

        return res.json({
          success: true,
          data: {
            is_logged_in: true,
            message: '您已经登录了'
          }
        });
      }

      // 等待二维码出现
      logger.info('⏳ 等待二维码出现...');
      try {
        await this.page.waitForSelector('.login-container .qrcode-img, .qrcode-img', { timeout: 10000 });
        logger.info('✅ 二维码元素找到');
      } catch (error) {
        logger.error('❌ 未找到二维码元素:', error.message);
        await this.cleanup();
        return res.status(500).json({
          success: false,
          error: '未找到二维码，请稍后重试'
        });
      }

      // 获取二维码图片
      const qrcodeElement = await this.page.$('.login-container .qrcode-img, .qrcode-img');
      if (!qrcodeElement) {
        await this.cleanup();
        return res.status(500).json({
          success: false,
          error: '无法获取二维码'
        });
      }

      logger.info('📸 正在截取二维码...');
      const qrcodeBase64 = await qrcodeElement.screenshot({ encoding: 'base64' });
      logger.info('✅ 二维码截取成功，长度:', qrcodeBase64.length);

      // 在后台等待登录完成
      this.startLoginMonitoring();

      res.json({
        success: true,
        data: {
          qrcode: `data:image/png;base64,${qrcodeBase64}`,
          img: `data:image/png;base64,${qrcodeBase64}`,
          message: '请使用小红书 APP 扫描二维码登录',
          timeout: '4m0s',
          is_logged_in: false
        }
      });

    } catch (error) {
      logger.error('获取二维码失败:', error);
      await this.cleanup();
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 检查页面上的登录状态
   */
  async checkLoginStatusOnPage() {
    try {
      if (!this.page) return false;

      // 检查多个可能的登录标识元素
      const selectors = [
        '.main-container .user .link-wrapper .channel',
        '.user-info',
        '.user-avatar',
        '[class*="user"]'
      ];

      for (const selector of selectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            logger.info(`✅ 找到登录标识元素: ${selector}`);
            return true;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }

      return false;
    } catch (error) {
      logger.error('检查登录状态失败:', error);
      return false;
    }
  }

  /**
   * 开始监控登录状态
   */
  startLoginMonitoring() {
    if (this.loginCheckInterval) {
      clearInterval(this.loginCheckInterval);
    }

    logger.info('🔍 开始监控登录状态...');
    let checkCount = 0;
    const maxChecks = 120; // 4分钟，每2秒检查一次

    this.loginCheckInterval = setInterval(async () => {
      checkCount++;

      if (checkCount > maxChecks) {
        logger.info('⏰ 登录超时，停止监控');
        clearInterval(this.loginCheckInterval);
        await this.cleanup();
        return;
      }

      try {
        const isLoggedIn = await this.checkLoginStatusOnPage();

        if (isLoggedIn) {
          logger.info('✅ 检测到登录成功！');
          clearInterval(this.loginCheckInterval);

          // 保存 cookies
          await this.saveCookies();

          // 清理浏览器
          await this.cleanup();
        }
      } catch (error) {
        logger.error('检查登录状态时出错:', error);
      }
    }, 2000);
  }

  /**
   * 保存 cookies
   */
  async saveCookies() {
    try {
      if (!this.context) {
        logger.error('❌ 浏览器上下文不存在，无法保存 cookies');
        return;
      }

      // 访问创作者中心以获取完整的 cookies
      logger.info('🔗 访问创作者中心以获取完整 cookies...');
      try {
        await this.page.goto('https://creator.xiaohongshu.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        await this.page.waitForTimeout(2000);
        logger.info('✅ 已访问创作者中心');
      } catch (error) {
        logger.warn('⚠️ 访问创作者中心失败:', error.message);
      }

      const cookies = await this.context.cookies();
      logger.info(`📝 获取到 ${cookies.length} 个 cookies`);

      // 确保目录存在
      const dir = path.dirname(this.cookiePath);
      await fs.mkdir(dir, { recursive: true });

      // 保存 cookies
      const cookiesJson = JSON.stringify(cookies, null, 2);
      await fs.writeFile(this.cookiePath, cookiesJson);
      logger.info('✅ Cookies 已保存到:', this.cookiePath);

      // 同步到 MCP 容器（如果容器正在运行）
      try {
        // 先保存到临时文件，然后复制到容器
        const tempFile = path.join(process.cwd(), 'temp_cookies.json');
        await fs.writeFile(tempFile, cookiesJson);

        // 使用 docker cp 命令复制文件到容器
        await execAsync(`docker cp "${tempFile}" xhs-mcp-server:/app/data/cookies.json`);

        // 删除临时文件
        await fs.unlink(tempFile);

        logger.info('✅ Cookies 已同步到 MCP 容器');
      } catch (error) {
        logger.warn('⚠️ 同步 cookies 到 MCP 容器失败:', error.message);
      }

    } catch (error) {
      logger.error('保存 cookies 失败:', error);
      throw error;
    }
  }

  /**
   * 检查登录状态
   */
  async checkLoginStatus(req, res) {
    try {
      // 检查 cookie 文件是否存在
      try {
        await fs.access(this.cookiePath);
        const cookieContent = await fs.readFile(this.cookiePath, 'utf-8');
        const cookies = JSON.parse(cookieContent);

        // 检查 cookies 是否有效（简单检查）
        const isLoggedIn = cookies && cookies.length > 0;

        res.json({
          success: true,
          data: {
            logged_in: isLoggedIn,
            account: isLoggedIn ? '小红书用户' : 'xiaohongshu-mcp',
            cookie_count: cookies.length
          }
        });
      } catch (error) {
        // 文件不存在或读取失败
        res.json({
          success: true,
          data: {
            logged_in: false,
            account: 'xiaohongshu-mcp'
          }
        });
      }
    } catch (error) {
      logger.error('检查登录状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 删除 cookies（退出登录）
   */
  async deleteCookies(req, res) {
    try {
      // 删除本地 cookies 文件
      try {
        await fs.unlink(this.cookiePath);
        logger.info('✅ 本地 cookies 已删除');
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // 删除 MCP 容器内的 cookies
      try {
        await execAsync('docker exec xhs-mcp-server sh -c "rm -f /app/data/cookies.json"');
        logger.info('✅ MCP 容器 cookies 已删除');
      } catch (error) {
        logger.warn('⚠️ 删除 MCP 容器 cookies 失败:', error.message);
      }

      res.json({
        success: true,
        message: 'Cookies 已删除，请刷新页面重新登录'
      });
    } catch (error) {
      logger.error('删除 cookies 失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 清理浏览器资源
   */
  async cleanup() {
    try {
      if (this.loginCheckInterval) {
        clearInterval(this.loginCheckInterval);
        this.loginCheckInterval = null;
      }

      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      logger.info('✅ 浏览器资源已清理');
    } catch (error) {
      logger.error('清理浏览器资源失败:', error);
    }
  }
}

export default new EnhancedXhsLoginService();
