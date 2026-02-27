/**
import logger from '../utils/logger.js';
 * 小红书主站登录服务
 * 用于获取主站Cookie，支持热门笔记爬取
 */

import { chromium } from 'playwright';
import accountManagementService from './accountManagementService.js';

class XhsMainSiteLoginService {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.loginCheckInterval = null;
    this.currentAccountId = null;
    this.initialCookieCount = 0;  // 记录初始Cookie数量
  }

  /**
   * 获取主站登录二维码
   */
  async getMainSiteQRCode(req, res) {
    try {
      const { account_id } = req.query;

      // 获取账户ID
      let accountId = account_id ? parseInt(account_id) : null;
      if (!accountId) {
        const activeAccount = accountManagementService.getActiveAccount();
        if (!activeAccount) {
          return res.status(400).json({
            success: false,
            error: '请先选择或创建账户'
          });
        }
        accountId = activeAccount.id;
      }

      this.currentAccountId = accountId;
      logger.info(`🚀 开始为账户 ${accountId} 获取主站登录二维码...`);

      // 清理之前的浏览器实例
      await this.cleanup();

      // 启动浏览器 - 使用完全隔离的用户数据目录
      logger.info('📦 正在启动 Chromium（完全隔离模式）...');
      this.browser = await chromium.launch({
        headless: false,
        args: [
          '--start-maximized',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--no-default-browser-check'
        ]
      });
      logger.info('✅ Chromium 启动成功');

      // 创建浏览器上下文 - 完全清空的上下文
      this.context = await this.browser.newContext({
        viewport: null,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        // 确保没有任何预存的cookies
        storageState: undefined
      });
      logger.info('✅ 浏览器上下文创建成功（无Cookie）');

      // 验证初始状态没有Cookie
      const initialCookies = await this.context.cookies();
      logger.info(`📊 初始Cookie数量: ${initialCookies.length}`);

      // 创建新页面
      this.page = await this.context.newPage();
      logger.info('✅ 新页面创建成功');

      // 访问小红书主站
      logger.info('🌐 正在访问小红书主站...');
      try {
        await this.page.goto('https://www.xiaohongshu.com', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      } catch (error) {
        logger.info('⚠️ 首次加载超时，尝试重新加载...');
        await this.page.goto('https://www.xiaohongshu.com', {
          waitUntil: 'load',
          timeout: 60000
        });
      }
      logger.info('✅ 主站页面加载成功');

      // 等待并点击登录按钮
      try {
        await this.page.waitForSelector('.login-btn, .sign-in-button, [class*="login"]', { timeout: 5000 });
        await this.page.click('.login-btn, .sign-in-button, [class*="login"]');
        logger.info('✅ 点击登录按钮成功');
      } catch (e) {
        logger.info('⚠️ 未找到登录按钮，可能已在登录页面');
      }

      // 等待二维码出现
      await this.page.waitForTimeout(2000);

      // 记录初始Cookie数量（登录前）
      const beforeLoginCookies = await this.context.cookies();
      this.initialCookieCount = beforeLoginCookies.length;
      logger.info(`📊 登录前Cookie数量: ${this.initialCookieCount}`);

      logger.info('✅ 浏览器已打开，等待用户扫码登录...');

      // 开始轮询检查登录状态
      this.startMainSiteLoginCheck();

      res.json({
        success: true,
        message: '请在浏览器中扫码登录'
      });

    } catch (error) {
      logger.error('❌ 获取主站登录二维码失败:', error);
      await this.cleanup();
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 检查主站登录状态
   */
  async checkMainSiteLoginStatus() {
    try {
      if (!this.page) {
        return false;
      }

      const currentUrl = this.page.url();
      logger.info(`🔍 检查主站登录状态，当前 URL: ${currentUrl}`);

      // 如果在登录页面或explore页面，检查Cookie变化
      if (currentUrl.includes('/login') || currentUrl.includes('/signin')) {
        logger.info('🔍 当前在登录页面，判断为未登录');
        return false;
      }

      // 方法1：检查URL是否跳转到用户页面（最可靠）
      if (currentUrl.includes('/user/profile/')) {
        logger.info('✅ 已跳转到用户主页，判断为已登录');
        return true;
      }

      // 方法2：在explore页面，需要更严���的检查
      if (currentUrl.includes('/explore')) {
        const cookies = await this.context.cookies();
        const currentCookieCount = cookies.length;

        // 检查关键Cookie
        const hasWebSession = cookies.some(cookie => cookie.name === 'web_session');
        const hasA1 = cookies.some(cookie => cookie.name === 'a1');
        const hasWebId = cookies.some(cookie => cookie.name === 'webId');

        logger.info(`📊 Cookies 统计: 初始=${this.initialCookieCount}, 当前=${currentCookieCount}, web_session=${hasWebSession}, a1=${hasA1}, webId=${hasWebId}`);

        // 在explore页面，Cookie必须明显增加（至少2个）才判断为登录
        const significantIncrease = currentCookieCount > this.initialCookieCount + 2;
        const hasAllAuthCookies = hasWebSession && hasA1 && hasWebId;

        if (significantIncrease && hasAllAuthCookies) {
          logger.info(`✅ Cookie数量明显增加了${currentCookieCount - this.initialCookieCount}个，且有完整认证Cookie，判断为已登录`);
          return true;
        }

        logger.info(`🔍 Cookie未明显增加（需要+3以上），判断为未登录`);
        return false;
      }

      // 其他页面，检查Cookie
      const cookies = await this.context.cookies();
      const currentCookieCount = cookies.length;
      const hasWebSession = cookies.some(cookie => cookie.name === 'web_session');
      const hasA1 = cookies.some(cookie => cookie.name === 'a1');
      const hasWebId = cookies.some(cookie => cookie.name === 'webId');

      logger.info(`📊 Cookies 统计: 初始=${this.initialCookieCount}, 当前=${currentCookieCount}, web_session=${hasWebSession}, a1=${hasA1}, webId=${hasWebId}`);

      const cookieIncreased = currentCookieCount > this.initialCookieCount;
      const hasAllAuthCookies = hasWebSession && hasA1 && hasWebId;

      if (cookieIncreased && hasAllAuthCookies) {
        logger.info(`✅ Cookie数量增加了${currentCookieCount - this.initialCookieCount}个，且有完整认证Cookie，判断为已登录`);
        return true;
      }

      logger.info(`🔍 Cookie未增加或不完整，判断为未登录`);
      return false;
    } catch (error) {
      logger.error('检查主站登录状态失败:', error);
      return false;
    }
  }

  /**
   * 开始轮询检查主站登录状态
   */
  startMainSiteLoginCheck() {
    logger.info('🔄 开始轮询检查主站登录状态...');

    this.loginCheckInterval = setInterval(async () => {
      try {
        const isLoggedIn = await this.checkMainSiteLoginStatus();

        if (isLoggedIn) {
          logger.info('✅ 检测到主站登录成功！');
          clearInterval(this.loginCheckInterval);

          // 保存主站cookies
          try {
            await this.saveMainSiteCookies();
            logger.info('🎉 主站登录流程完成！');
          } catch (saveError) {
            logger.error('❌ 保存主站 cookies 失败:', saveError.message);
          }

          // 清理浏览器
          await this.cleanup();
        }
      } catch (error) {
        logger.error('检查主站登录状态时出错:', error);
        clearInterval(this.loginCheckInterval);
        await this.cleanup();
      }
    }, 2000);
  }

  /**
   * 保存主站cookies到数据库
   */
  async saveMainSiteCookies() {
    try {
      if (!this.context) {
        logger.error('❌ 浏览器上下文不存在，无法保存主站 cookies');
        return;
      }

      logger.info('📝 正在获取主站 cookies...');

      const currentUrl = this.page.url();
      logger.info(`🔗 当前 URL: ${currentUrl}`);

      const cookies = await this.context.cookies();
      logger.info(`📝 获取到 ${cookies.length} 个主站 cookies`);

      // 打印关键cookies
      const keyCookies = cookies.filter(c =>
        c.name.includes('web_session') ||
        c.name.includes('a1') ||
        c.name.includes('webId')
      );
      logger.info(`🔑 关键 cookies: ${keyCookies.map(c => c.name).join(', ')}`);

      // 保存到数据库
      if (this.currentAccountId) {
        accountManagementService.saveMainSiteCookies(this.currentAccountId, cookies);
        logger.info(`✅ 主站 Cookies 已保存到账户 ${this.currentAccountId}`);
      }

    } catch (error) {
      logger.error('保存主站 cookies 失败:', error);
      throw error;
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
        await this.page.close().catch(() => {});
        this.page = null;
      }

      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }

      logger.info('✅ 浏览器资源已清理');
    } catch (error) {
      logger.error('清理浏览器资源失败:', error);
    }
  }

  /**
   * 检查主站登录状态（API）
   */
  async checkMainSiteLoginStatusAPI(req, res) {
    try {
      const { account_id } = req.query;

      let accountId = account_id ? parseInt(account_id) : null;
      if (!accountId) {
        const activeAccount = accountManagementService.getActiveAccount();
        if (!activeAccount) {
          return res.json({
            success: true,
            data: {
              logged_in: false,
              message: '请先创建账户'
            }
          });
        }
        accountId = activeAccount.id;
      }

      const account = accountManagementService.getAccountById(accountId);
      if (!account) {
        return res.status(404).json({
          success: false,
          error: '账户不存在'
        });
      }

      const mainSiteLoggedIn = account.main_site_login_status === 'logged_in';
      const hasMainSiteCookies = account.main_site_cookies && account.main_site_cookies.length > 10;

      res.json({
        success: true,
        data: {
          logged_in: mainSiteLoggedIn && hasMainSiteCookies,
          account_name: account.account_name,
          last_login_at: account.main_site_last_login_at
        }
      });

    } catch (error) {
      logger.error('❌ 检查主站登录状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new XhsMainSiteLoginService();
