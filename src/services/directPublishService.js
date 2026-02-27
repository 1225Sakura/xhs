/**
 * 临时发布脚本 - 绕过 MCP 服务
 *
 * 由于 MCP 服务存在死锁问题，此脚本提供临时解决方案
 * 使用 Playwright 直接控制浏览器发布到小红书
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const COOKIES_PATH = process.env.COOKIES_PATH || 'E:/xhs/external/xiaohongshu-mcp/data/cookies.json';
const XHS_CREATOR_URL = 'https://creator.xiaohongshu.com/publish/publish';

async function publishToXhs(title, content, images = []) {
  console.log('🚀 启动浏览器...');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'zh-CN',
    });

    // 隐藏 webdriver 特征
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    const page = await context.newPage();

    // 加载 cookies
    if (fs.existsSync(COOKIES_PATH)) {
      console.log('🍪 加载 cookies...');
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
      await context.addCookies(cookies);
    }

    // 直接访问发布页面（不再先访问主站）
    console.log('📄 访问发布页面...');
    await page.goto(XHS_CREATOR_URL, {
      waitUntil: 'domcontentloaded',  // 使用更宽松的等待条件
      timeout: 60000
    });

    // 等待页面加载
    await page.waitForTimeout(2000);

    // 检查是否需要登录
    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      throw new Error('需要登录，请先通过浏览器登录并保存 cookies');
    }

    // 填写标题
    console.log('✍️  填写标题...');
    const titleInput = await page.$('input[placeholder*="标题"]');
    if (titleInput) {
      await titleInput.fill(title);
    }

    // 填写内容
    console.log('✍️  填写内容...');
    const contentArea = await page.$('div[contenteditable="true"]');
    if (contentArea) {
      await contentArea.fill(content);
    }

    // 上传图片（如果有）
    if (images.length > 0) {
      console.log(`📷 上传 ${images.length} 张图片...`);
      const inputUpload = await page.$('input[type="file"]');
      if (inputUpload) {
        await inputUpload.setInputFiles(images);
        await page.waitForTimeout(3000); // 等待图片上传
      }
    }

    // 点击发布按钮
    console.log('📤 点击发布...');

    // 等待一下确保页面完全加载
    await page.waitForTimeout(2000);

    // 尝试多种方式查找发布按钮
    let publishButton = await page.$('button:has-text("发布")');
    if (!publishButton) {
      publishButton = await page.$('button[type="submit"]');
    }
    if (!publishButton) {
      publishButton = await page.$('button:text("发布")');
    }
    if (!publishButton) {
      publishButton = await page.$('.publish-btn, .submit-btn, [class*="publish"], [class*="submit"]');
    }

    if (publishButton) {
      await publishButton.click();
      console.log('✅ 已点击发布按钮');
    } else {
      // 截图以便调试
      const screenshotPath = path.join(process.cwd(), 'data', 'temp', `no-button-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('📸 未找到发布按钮，已保存截图:', screenshotPath);
      throw new Error('未找到发布按钮');
    }

    // 等待发布完成 - 检查成功标识
    console.log('⏳ 等待发布完成...');
    try {
      // 等待成功提示或页面跳转（最多等待30秒）
      await Promise.race([
        page.waitForSelector('text=发布成功', { timeout: 30000 }),
        page.waitForSelector('.success', { timeout: 30000 }),
        page.waitForURL(/.*\/publish\/success.*/, { timeout: 30000 })
      ]);

      console.log('✅ 发布成功！');
      return { success: true };
    } catch (waitError) {
      // 如果没有找到成功标识，检查是否有错误提示
      const errorElement = await page.$('.error, .error-message, [class*="error"]');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        throw new Error(`发布失败: ${errorText}`);
      }

      // 截图保存以便调试
      const screenshotPath = path.join(process.cwd(), 'data', 'temp', `publish-error-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log('📸 已保存截图:', screenshotPath);

      throw new Error('发布超时或未检测到成功标识，请检查截图');
    }

  } catch (error) {
    console.error('❌ 发布失败:', error.message);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

// 测试发布
if (import.meta.url === `file://${process.argv[1]}`) {
  publishToXhs(
    '测试标题',
    '测试内容\n这是一条测试笔记',
    []
  ).then(result => {
    console.log('结果:', result);
    process.exit(result.success ? 0 : 1);
  });
}

export default publishToXhs;
