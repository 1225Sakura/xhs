/**
 * 多账户小红书登录服务
 * 支持多账户管理和切换
 */

import { chromium } from 'playwright';
import accountManagementService from './accountManagementService.js';
import logger from '../utils/logger.js';

class MultiAccountXhsLoginService {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.loginCheckInterval = null;
    this.currentAccountId = null;
  }

  /**
   * 获取登录二维码
   */
  async getQRCode(req, res) {
    try {
      const { account_id, force_new } = req.query;

      // 如果没有指定账户，使用当前活跃账户
      let accountId = account_id ? parseInt(account_id) : null;
      if (!accountId) {
        let activeAccount = accountManagementService.getActiveAccount();

        // 如果没有活跃账户，检查是否有任何账户
        if (!activeAccount) {
          const allAccounts = accountManagementService.getAllAccounts();

          // 如果完全没有账户，创建一个默认账户
          if (allAccounts.length === 0) {
            logger.info('📝 没有账户，创建默认账户...');
            const result = accountManagementService.createAccount('默认账户');
            if (!result.success) {
              return res.status(500).json({
                success: false,
                error: '创建默认账户失败: ' + result.error
              });
            }
            accountId = result.accountId;
            logger.info(`✅ 默认账户创建成功，ID: ${accountId}`);
          } else {
            // 如果有账户但没有活跃账户，使用第一个账户
            accountId = allAccounts[0].id;
            accountManagementService.switchAccount(accountId);
            logger.info(`✅ 使用第一个账户，ID: ${accountId}`);
          }
        } else {
          accountId = activeAccount.id;
        }
      }

      this.currentAccountId = accountId;
      logger.info(`🚀 开始为账户 ${accountId} 获取二维码...`);
      if (force_new) {
        logger.info('🔄 强制获取新二维码（忽略已有登录状态）');
      }

      // 清理之前的浏览器实例
      await this.cleanup();

      // 启动浏览器（使用无痕模式）
      logger.info('📦 正在启动 Chromium（无痕模式）...');
      this.browser = await chromium.launch({
        headless: false,  // 使用有头模式方便调试
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--incognito'  // 无痕模式
        ]
      });
      logger.info('✅ Chromium 启动成功');

      // 创建无痕浏览器上下文
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'zh-CN',
        // 不使用任何存储状态，确保是全新的会话
        storageState: undefined
      });

      // 隐藏 webdriver 特征
      await this.context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      logger.info('✅ 浏览器上下文创建成功');

      this.page = await this.context.newPage();
      logger.info('✅ 新页面创建成功');

      // 直接访问创作者中心登录页面（而不是主界面）
      // 这样可以确保 cookies 对创作者中心有效
      logger.info('🌐 正在访问创作者中心登录页面...');
      try {
        await this.page.goto('https://creator.xiaohongshu.com', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        logger.info('✅ 创作者中心页面加载成功');
      } catch (error) {
        logger.warn('⚠️ 页面加载超时，尝试继续...', error.message);
      }

      // 等待页面稳定
      await this.page.waitForTimeout(3000);

      // 如果不是强制获取新二维码，检查是否已经登录
      if (!force_new) {
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
      } else {
        logger.info('⏭️ 跳过登录状态检查，直接获取二维码');
      }

      // 等待登录窗口加载
      logger.info('⏳ 等待登录窗口加载...');
      await this.page.waitForTimeout(3000);

      // 返回成功，告诉前端浏览器已打开，用户可以手动登录
      logger.info('✅ 浏览器已打开，等待用户手动完成登录...');

      // 开始轮询检查登录状态
      this.startLoginCheck();

      res.json({
        success: true,
        data: {
          manual_login: true,
          message: '请在浏览器中手动完成登录（切换到二维码并扫码）',
          account_id: accountId
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
   * 改进版：使用 URL 和 Cookie 检测
   */
  async checkLoginStatusOnPage() {
    try {
      // 方法1：检查 URL（如果还在登录页面，说明未登录）
      const currentUrl = this.page.url();
      logger.info(`🔍 检查登录状态，当前 URL: ${currentUrl}`);

      if (currentUrl.includes('/login') || currentUrl.includes('/signin')) {
        logger.info('🔍 当前在登录页面，判断为未登录状态');
        return false;
      }

      // 方法2：检查是否有用户信息元素
      // 创作者中心的页面结构可能不同
      try {
        await this.page.waitForTimeout(1000);

        // 尝试多个可能的选择器
        const selectors = [
          '.main-container .user .link-wrapper .channel',
          '.user-info',
          '.avatar',
          '[class*="UserInfo"]',
          '[class*="user"]'
        ];

        for (const selector of selectors) {
          const element = await this.page.$(selector);
          if (element) {
            logger.info(`✅ 检测到用户元素 (${selector})，判断为已登录`);
            return true;
          }
        }
      } catch (e) {
        logger.info('⚠️ 检查用户元素时出错:', e.message);
      }

      // 方法3：检查是否有关键 Cookie
      const cookies = await this.context.cookies();
      const hasAuthCookie = cookies.some(cookie =>
        cookie.name.includes('web_session') ||
        cookie.name.includes('token') ||
        cookie.name.includes('auth') ||
        cookie.name.includes('session')
      );

      logger.info(`📊 Cookies 统计: 总数=${cookies.length}, 有认证cookie=${hasAuthCookie}`);

      // 只有在 cookies 数量足够多（>15）且有认证 cookie 时才判断为已登录
      if (hasAuthCookie && cookies.length > 15) {
        logger.info(`✅ 检测到大量认证 Cookie (共 ${cookies.length} 个)，判断为已登录`);
        return true;
      }

      logger.info(`🔍 未找到明确的登录标识 (cookies: ${cookies.length})，判断为未登录`);
      return false;
    } catch (error) {
      logger.error('检查登录状态失败:', error);
      return false;
    }
  }

  /**
   * 开始轮询检查登录状态
   */

  /**
   * 开始轮询检查登录状态
   */
  startLoginCheck() {
    logger.info('🔄 开始轮询检查登录状态...');

    this.loginCheckInterval = setInterval(async () => {
      try {
        const isLoggedIn = await this.checkLoginStatusOnPage();

        if (isLoggedIn) {
          logger.info('✅ 检测到登录成功！');
          clearInterval(this.loginCheckInterval);

          // 保存 cookies
          try {
            await this.saveCookies();
            logger.info('🎉 登录流程完成！');
          } catch (saveError) {
            logger.error('❌ 保存 cookies 失败:', saveError.message);
            // 如果保存失败，更新登录状态为失败
            if (this.currentAccountId) {
              accountManagementService.updateLoginStatus(this.currentAccountId, false, null);
            }
          }

          // 清理浏览器
          await this.cleanup();
        }
      } catch (error) {
        logger.error('检查登录状态时出错:', error);
        clearInterval(this.loginCheckInterval);
        await this.cleanup();
      }
    }, 2000);
  }

  /**
   * 保存 cookies 到数据库
   */
  async saveCookies() {
    try {
      if (!this.context) {
        logger.error('❌ 浏览器上下文不存在，无法保存 cookies');
        return;
      }

      // 已经在创作者中心了，直接获取 cookies
      logger.info('📝 正在获取创作者中心 cookies...');

      // 确认当前在创作者中心
      const currentUrl = this.page.url();
      logger.info(`🔗 当前 URL: ${currentUrl}`);

      // 检查是否被重定向到登录页面
      if (currentUrl.includes('/login') || currentUrl.includes('/signin')) {
        logger.error('❌ 当前仍在登录页面，cookies 可能无效');
        throw new Error('登录未完成，请确保扫码成功');
      }

      const cookies = await this.context.cookies();
      logger.info(`📝 获取到 ${cookies.length} 个 cookies`);

      // 打印关键 cookies 用于调试
      const keyCookies = cookies.filter(c =>
        c.name.includes('web_session') ||
        c.name.includes('token') ||
        c.name.includes('auth')
      );
      logger.info(`🔑 关键 cookies: ${keyCookies.map(c => c.name).join(', ')}`);

      // 保存到数据库
      if (this.currentAccountId) {
        accountManagementService.saveAccountCookies(this.currentAccountId, cookies);
        // 更新登录状态为已登录
        accountManagementService.updateLoginStatus(this.currentAccountId, true, cookies);
        logger.info(`✅ Cookies 已保存到账户 ${this.currentAccountId}`);
      }

    } catch (error) {
      logger.error('保存 cookies 失败:', error);
      throw error;
    }
  }

  /**
   * 检查登录状态
   * 综合方案：检查数据库 + 验证 cookies 有效性
   */
  async checkLoginStatus(req, res) {
    try {
      const { account_id } = req.query;

      // 如果没有指定账户，使用当前活跃账户
      let accountId = account_id ? parseInt(account_id) : null;
      if (!accountId) {
        let activeAccount = accountManagementService.getActiveAccount();

        // 如果没有活跃账户，检查是否有任何账户
        if (!activeAccount) {
          const allAccounts = accountManagementService.getAllAccounts();

          // 如果完全没有账户，返回未登录状态
          if (allAccounts.length === 0) {
            return res.json({
              success: true,
              data: {
                logged_in: false,
                message: '请先创建账户'
              }
            });
          } else {
            // 如果有账户但没有活跃账户，使用第一个账户
            accountId = allAccounts[0].id;
            accountManagementService.switchAccount(accountId);
          }
        } else {
          accountId = activeAccount.id;
        }
      }

      const account = accountManagementService.getAccountById(accountId);
      if (!account) {
        return res.status(404).json({
          success: false,
          error: '账户不存在'
        });
      }

      // 方法1：检查数据库中的登录状态
      const dbLoggedIn = account.login_status === 'logged_in';
      const hasCookies = account.cookies && account.cookies.length > 10;

      // 如果数据库显示未登录或没有 cookies，直接返回未登录
      if (!dbLoggedIn || !hasCookies) {
        return res.json({
          success: true,
          data: {
            logged_in: false,
            account_name: account.account_name,
            account_id: account.id,
            message: '未登录或 cookies 已清除'
          }
        });
      }

      // 方法2：检查关键 cookies 过期时间
      try {
        const cookies = JSON.parse(account.cookies);
        const now = Date.now() / 1000; // 转换为秒

        // 只检查关键认证 cookies 是否过期
        const criticalCookieNames = ['web_session', 'access-token-creator.xiaohongshu.com', 'a1'];
        const expiredCriticalCookies = cookies.filter(cookie => {
          // 只检查关键Cookie
          if (!criticalCookieNames.includes(cookie.name)) {
            return false;
          }
          // 检查是否过期
          if (cookie.expires && cookie.expires > 0) {
            return cookie.expires < now;
          }
          return false;
        });

        if (expiredCriticalCookies.length > 0) {
          logger.info(`⚠️ 发现 ${expiredCriticalCookies.length} 个关键 cookies 过期: ${expiredCriticalCookies.map(c => c.name).join(', ')}`);

          // 更新数据库状态为未登录
          accountManagementService.updateLoginStatus(accountId, false, null);

          return res.json({
            success: true,
            data: {
              logged_in: false,
              account_name: account.account_name,
              account_id: account.id,
              message: '登录已过期，请重新登录'
            }
          });
        }

        // 检查是否有关键Cookie
        const hasCriticalCookies = criticalCookieNames.some(name =>
          cookies.some(cookie => cookie.name === name)
        );

        if (!hasCriticalCookies) {
          logger.info('⚠️ 缺少关键认证 cookies');
          accountManagementService.updateLoginStatus(accountId, false, null);

          return res.json({
            success: true,
            data: {
              logged_in: false,
              account_name: account.account_name,
              account_id: account.id,
              message: '缺少认证信息，请重新登录'
            }
          });
        }

        // 方法3：实际验证 cookies 是否有效（可选，较慢但最准确）
        // 这里我们可以启动一个浏览器实例来验证
        // 但为了性能考虑，我们只在必要时才这样做

        res.json({
          success: true,
          data: {
            logged_in: true,
            account_name: account.account_name,
            account_id: account.id,
            cookie_count: cookies.length,
            last_login: account.last_login_at
          }
        });

      } catch (parseError) {
        logger.error('解析 cookies 失败:', parseError);

        // cookies 格式错误，标记为未登录
        accountManagementService.updateLoginStatus(accountId, false, null);

        return res.json({
          success: true,
          data: {
            logged_in: false,
            account_name: account.account_name,
            account_id: account.id,
            message: 'Cookies 数据损坏，请重新登录'
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
   * 深度验证 cookies 有效性（通过实际访问页面）
   * 参考 xiaohongshu-mcp 的实现
   */
  async verifyCookiesValidity(accountId) {
    let browser = null;
    let context = null;

    try {
      const account = accountManagementService.getAccountById(accountId);
      if (!account || !account.cookies) {
        return { valid: false, reason: '没有 cookies' };
      }

      const cookies = JSON.parse(account.cookies);

      // 启动无头浏览器
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // 添加 cookies
      await context.addCookies(cookies);

      const page = await context.newPage();

      // 访问小红书首页
      await page.goto('https://www.xiaohongshu.com/explore', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await page.waitForTimeout(2000);

      // 检查是否已登录（参考 xiaohongshu-mcp 的方法）
      // 方法1：检查用户元素
      const userElement = await page.$('.main-container .user .link-wrapper .channel');
      if (userElement) {
        await browser.close();
        return { valid: true, reason: '找到用户元素' };
      }

      // 方法2：检查 URL 是否包含 login
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/signin')) {
        await browser.close();
        return { valid: false, reason: 'URL 包含 login，需要重新登录' };
      }

      // 方法3：检查是否有二维码（说明未登录）
      const qrcode = await page.$('.qrcode-img, .login-container .qrcode-img');
      if (qrcode) {
        await browser.close();
        return { valid: false, reason: '页面显示二维码，需要重新登录' };
      }

      await browser.close();
      return { valid: true, reason: '未发现登录问题' };

    } catch (error) {
      logger.error('验证 cookies 失败:', error);
      if (browser) {
        await browser.close();
      }
      return { valid: false, reason: `验证失败: ${error.message}` };
    }
  }

  /**
   * API 端点：深度验证登录状态
   */
  async verifyLoginDeep(req, res) {
    try {
      const { account_id } = req.query;

      // 获取账户 ID
      let accountId = account_id ? parseInt(account_id) : null;
      if (!accountId) {
        const activeAccount = accountManagementService.getActiveAccount();
        if (!activeAccount) {
          return res.status(400).json({
            success: false,
            error: '请先创建或选择一个账户'
          });
        }
        accountId = activeAccount.id;
      }

      logger.info(`🔍 开始深度验证账户 ${accountId} 的登录状态...`);

      const result = await this.verifyCookiesValidity(accountId);

      if (!result.valid) {
        // 如果验证失败，更新数据库状态
        accountManagementService.updateLoginStatus(accountId, false, null);
        logger.info(`❌ 验证失败: ${result.reason}`);
      } else {
        logger.info(`✅ 验证成功: ${result.reason}`);
      }

      res.json({
        success: true,
        data: {
          logged_in: result.valid,
          reason: result.reason
        }
      });

    } catch (error) {
      logger.error('深度验证失败:', error);
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
      const { account_id } = req.query;

      // 如果没有指定账户，使用当前活跃账户
      let accountId = account_id ? parseInt(account_id) : null;
      if (!accountId) {
        const activeAccount = accountManagementService.getActiveAccount();
        if (!activeAccount) {
          return res.status(400).json({
            success: false,
            error: '请先创建或选择一个账户'
          });
        }
        accountId = activeAccount.id;
      }

      // 更新账户登录状态
      accountManagementService.updateLoginStatus(accountId, false, null);

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

export default new MultiAccountXhsLoginService();
