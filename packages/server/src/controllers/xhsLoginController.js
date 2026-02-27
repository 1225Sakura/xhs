/**
 * 小红书登录控制器
 * 使用 Playwright 实现扫码登录，并将 cookie 保存到 MCP 服务器的数据目录
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

class XhsLoginController {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.cookiePath = path.join(process.cwd(), 'external', 'xiaohongshu-mcp', 'data', 'cookies.json');
  }

  /**
   * 获取登录二维码
   */
  async getQRCode(req, res) {
    try {
      console.log('🚀 开始获取二维码...');

      // 启动浏览器
      console.log('📦 正在启动 Chromium...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer'
        ]
      });
      console.log('✅ Chromium 启动成功');

      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      console.log('✅ 浏览器上下文创建成功');

      this.page = await this.context.newPage();
      console.log('✅ 新页面创建成功');

      // 访问小红书登录页面
      console.log('🌐 正在访问小红书登录页面...');
      await this.page.goto('https://www.xiaohongshu.com', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      console.log('✅ 页面加载成功');

      // 等待二维码出现
      console.log('⏳ 等待二维码出现...');
      await this.page.waitForSelector('.qrcode-img', { timeout: 10000 });
      console.log('✅ 二维码元素找到');

      // 获取二维码图片
      const qrcodeElement = await this.page.$('.qrcode-img');
      console.log('📸 正在截取二维码...');
      const qrcodeBase64 = await qrcodeElement.screenshot({ encoding: 'base64' });
      console.log('✅ 二维码截取成功，长度:', qrcodeBase64.length);

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

      // 在后台等待登录完成
      this.waitForLogin();

    } catch (error) {
      console.error('获取二维码失败:', error);
      await this.cleanup();
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 等待用户扫码登录
   */
  async waitForLogin() {
    try {
      // 等待登录成功（URL 变化或特定元素出现）
      await this.page.waitForURL('**/explore', { timeout: 240000 }); // 4分钟超时

      console.log('✅ 检测到登录成功');

      // 保存 cookies
      const cookies = await this.context.cookies();
      await fs.writeFile(this.cookiePath, JSON.stringify(cookies, null, 2));
      console.log('✅ Cookies 已保存到:', this.cookiePath);

      // 清理浏览器
      await this.cleanup();

    } catch (error) {
      console.error('等待登录失败:', error);
      await this.cleanup();
    }
  }

  /**
   * 检查登录状态
   */
  async checkLoginStatus(req, res) {
    try {
      // 优先检查数据库中的主账户登录状态
      try {
        const { default: db } = await import('../models/database.js');
        const stmt = db.prepare(`
          SELECT * FROM xhs_accounts
          WHERE is_primary = 1
          LIMIT 1
        `);
        const primaryAccount = stmt.get();

        console.log('🔍 检查主账户登录状态:', {
          found: !!primaryAccount,
          account_name: primaryAccount?.account_name,
          login_status: primaryAccount?.login_status,
          login_status_type: typeof primaryAccount?.login_status,
          is_logged_in: primaryAccount?.login_status === 'logged_in'
        });

        if (primaryAccount && primaryAccount.login_status === 'logged_in') {
          console.log('✅ 主账户已登录');
          return res.json({
            success: true,
            data: {
              logged_in: true,
              account_name: primaryAccount.account_name,
              account_id: primaryAccount.id,
              message: '已登录'
            }
          });
        } else {
          console.log('⚠️ 主账户未登录或不存在');
        }
      } catch (dbError) {
        console.warn('⚠️ 数据库检查失败，尝试文件检查:', dbError.message);
      }

      // 降级：检查 cookie 文件是否存在
      try {
        await fs.access(this.cookiePath);
        const cookieContent = await fs.readFile(this.cookiePath, 'utf-8');
        const cookies = JSON.parse(cookieContent);

        // 简单检查：如果有 cookie 就认为已登录
        const isLoggedIn = cookies && cookies.length > 0;

        res.json({
          success: true,
          data: {
            logged_in: isLoggedIn,
            cookie_count: cookies.length,
            message: isLoggedIn ? '已登录（文件）' : '未登录'
          }
        });
      } catch (error) {
        // 文件不存在或读取失败
        res.json({
          success: true,
          data: {
            logged_in: false,
            message: '未登录或 cookies 已清除'
          }
        });
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 删除 cookies
   */
  async deleteCookies(req, res) {
    try {
      await fs.unlink(this.cookiePath);
      res.json({
        success: true,
        message: 'Cookies 已删除'
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          message: 'Cookies 文件不存在'
        });
      } else {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  }

  /**
   * 清理浏览器资源
   */
  async cleanup() {
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch (error) {
      console.error('清理浏览器资源失败:', error);
    }
  }
}

export default new XhsLoginController();
