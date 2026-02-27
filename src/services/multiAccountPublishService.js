/**
 * 多账户小红书发布服务
 * 使用 Playwright 直接控制浏览器发布
 */

import { chromium } from 'playwright';
import accountManagementService from './accountManagementService.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';

class MultiAccountPublishService {
  /**
   * 发布笔记到小红书
   */
  async publishNote(title, content, images = [], accountId = null) {
    let browser = null;
    let page = null;

    try {
      // 如果没有指定账户，使用当前活跃账户
      if (!accountId) {
        const activeAccount = accountManagementService.getActiveAccount();
        if (!activeAccount) {
          return {
            success: false,
            error: '请先创建或选择一个账户'
          };
        }
        accountId = activeAccount.id;
      }

      // 获取账户信息
      const account = accountManagementService.getAccountById(accountId);
      if (!account) {
        return {
          success: false,
          error: '账户不存在'
        };
      }

      if (account.login_status !== 'logged_in') {
        return {
          success: false,
          error: '账户未登录，请先登录'
        };
      }

      // 验证 cookies 是否有效（检查过期时间）
      const cookies = accountManagementService.getAccountCookies(accountId);
      if (!cookies) {
        // 更新登录状态为未登录
        accountManagementService.updateLoginStatus(accountId, false, null);
        return {
          success: false,
          error: '账户 cookies 无效，请重新登录'
        };
      }

      // 检查关键 cookies 是否过期
      const now = Date.now() / 1000;
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
        // 更新登录状态为未登录
        accountManagementService.updateLoginStatus(accountId, false, null);
        return {
          success: false,
          error: '登录已过期，请重新登录'
        };
      }

      logger.info(`🚀 开始为账户 ${account.account_name} (ID: ${accountId}) 发布笔记...`);
      logger.info('📝 标题:', title);
      logger.info('📝 内容长度:', content.length);
      logger.info('🖼️ 图片数量:', images.length);

      // 启动浏览器
      browser = await chromium.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
        ],
      });

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

      // 加载账户的 cookies（已在前面验证过有效性）
      logger.info('🍪 加载账户 cookies...');
      await context.addCookies(cookies);

      page = await context.newPage();

      // 访问创作者中心首页（不是直接访问发布页面）
      logger.info('📄 导航到创作者中心...');
      await page.goto('https://creator.xiaohongshu.com', {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      // 等待页面加载
      await page.waitForTimeout(3000);

      // 检查是否需要登录
      let currentUrl = page.url();
      if (currentUrl.includes('login')) {
        logger.info('需要重新登录...');
        await browser.close();
        return {
          success: false,
          error: '用户未登录，请先登录'
        };
      }

      // 点击"发布笔记"按钮打开发布弹窗
      logger.info('📝 点击发布笔记按钮...');
      const publishSelectors = [
        '.publish-video .btn',  // 根据参考项目，这个选择器工作正常
        'button:has-text("发布笔记")',
        '.btn:has-text("发布笔记")',
        'text=发布笔记'
      ];

      let publishClicked = false;
      for (const selector of publishSelectors) {
        try {
          logger.info(`尝试发布按钮选择器: ${selector}`);
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector);
          logger.info(`✅ 成功点击发布按钮: ${selector}`);
          publishClicked = true;
          break;
        } catch (e) {
          logger.info(`发布按钮选择器 ${selector} 失败: ${e.message}`);
        }
      }

      if (!publishClicked) {
        const screenshotPath = path.join(process.cwd(), 'data', 'temp', `no-publish-button-${Date.now()}.png`);
        await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.info('📸 未找到发布按钮，已保存截图:', screenshotPath);

        await browser.close();
        return {
          success: false,
          error: '无法找到发布按钮'
        };
      }

      await page.waitForTimeout(3000);

      // 切换到上传图文选项卡（第二个tab）
      logger.info('🔄 切换到上传图文选项卡...');
      try {
        // 等待选项卡加载
        await page.waitForSelector('.creator-tab', { timeout: 10000 });

        // 使用JavaScript直接获取第二个选项卡并点击
        const tabClicked = await page.evaluate(() => {
          const tabs = document.querySelectorAll('.creator-tab');
          if (tabs.length > 1) {
            tabs[1].click();
            return true;
          }
          return false;
        });

        if (tabClicked) {
          logger.info('✅ 使用JavaScript方法点击第二个选项卡');
        } else {
          logger.warn('⚠️ 未找到第二个选项卡');
        }

        await page.waitForTimeout(2000);
      } catch (error) {
        logger.info(`切换选项卡失败: ${error.message}`);
        const screenshotPath = path.join(process.cwd(), 'data', 'temp', `debug-tabs-${Date.now()}.png`);
        await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath });
        logger.info('📸 已保存截图:', screenshotPath);
      }

      // 等待页面切换完成
      await page.waitForTimeout(3000);

      // 上传图片（如果有）
      logger.info('--- 开始图片上传流程 ---');
      if (images && images.length > 0) {
        try {
          // 将图片路径转换为绝对路径
          const absoluteImages = images.map(img => {
            // 如果已经是绝对路径（Windows: C:\\... 或 Linux: /home/...）
            if (path.isAbsolute(img) && !img.startsWith('/app/') && !img.startsWith('/uploads/')) {
              return img;
            }

            // 处理 MCP 容器路径 /app/uploads/...
            if (img.startsWith('/app/uploads/')) {
              return path.join(process.cwd(), img.replace('/app/', ''));
            }

            // 处理相对路径 /uploads/...
            if (img.startsWith('/uploads/')) {
              return path.join(process.cwd(), img.substring(1)); // 移除开头的 /
            }

            // 处理相对路径 uploads/...
            if (img.startsWith('uploads/')) {
              return path.join(process.cwd(), img);
            }

            // 其他情况，假设是相对于项目根目录
            return path.join(process.cwd(), img);
          });

          logger.info('📂 转换后的图片路径:', absoluteImages);

          // 检查文件是否存在
          for (const imgPath of absoluteImages) {
            if (!fs.existsSync(imgPath)) {
              logger.error(`❌ 图片文件不存在: ${imgPath}`);
              await browser.close();
              return {
                success: false,
                error: `图片文件不存在: ${imgPath}`
              };
            }
          }

          // 等待上传区域关键元素（如上传按钮）出现
          logger.info('等待上传按钮 .upload-button 出现...');
          await page.waitForSelector('.upload-button', { timeout: 20000 });
          await page.waitForTimeout(1500); // 短暂稳定延时

          let uploadSuccess = false;

          // --- 首选方法: 点击明确的 "上传图片" 按钮 ---
          if (!uploadSuccess) {
            logger.info('尝试首选方法: 点击 .upload-button');
            try {
              const buttonSelector = '.upload-button';
              await page.waitForSelector(buttonSelector, { state: 'visible', timeout: 10000 });
              logger.info(`按钮 '${buttonSelector}' 可见，准备点击.`);

              const [fileChooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 15000 }),
                page.click(buttonSelector, { timeout: 7000 })
              ]);

              logger.info(`已点击 '${buttonSelector}'. 文件选择器已出现`);
              await fileChooser.setFiles(absoluteImages);
              logger.info(`已通过文件选择器设置文件: ${absoluteImages}`);
              uploadSuccess = true;
              logger.info('✅ 首选方法成功: 点击 .upload-button 并设置文件');
            } catch (e) {
              logger.info(`❌ 首选方法 (点击 .upload-button) 失败: ${e.message}`);
              const screenshotPath = path.join(process.cwd(), 'data', 'temp', `debug-upload-button-click-failed-${Date.now()}.png`);
              await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
              await page.screenshot({ path: screenshotPath });
            }
          }

          // --- 方法0.5 (新增): 点击拖拽区域的文字提示区 ---
          if (!uploadSuccess) {
            logger.info('尝试方法0.5: 点击拖拽提示区域 ( .wrapper 或 .drag-over)');
            try {
              const clickableAreaSelectors = ['.wrapper', '.drag-over'];
              let clickedAreaSuccessfully = false;

              for (const areaSelector of clickableAreaSelectors) {
                try {
                  logger.info(`尝试点击区域: '${areaSelector}'`);
                  await page.waitForSelector(areaSelector, { state: 'visible', timeout: 5000 });
                  logger.info(`区域 '${areaSelector}' 可见，准备点击.`);

                  const [fileChooser] = await Promise.all([
                    page.waitForEvent('filechooser', { timeout: 10000 }),
                    page.click(areaSelector, { timeout: 5000 })
                  ]);

                  logger.info(`已点击区域 '${areaSelector}'. 文件选择器已出现`);
                  await fileChooser.setFiles(absoluteImages);
                  logger.info(`已通过文件选择器 (点击区域 '${areaSelector}') 设置文件: ${absoluteImages}`);
                  uploadSuccess = true;
                  clickedAreaSuccessfully = true;
                  logger.info(`✅ 方法0.5成功: 点击区域 '${areaSelector}' 并设置文件`);
                  break;
                } catch (innerE) {
                  logger.info(`尝试点击区域 '${areaSelector}' 失败: ${innerE.message}`);
                }
              }

              if (!clickedAreaSuccessfully) {
                logger.info('❌ 方法0.5 (点击拖拽提示区域) 所有内部尝试均失败');
                const screenshotPath = path.join(process.cwd(), 'data', 'temp', `debug-upload-all-area-clicks-failed-${Date.now()}.png`);
                await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
                await page.screenshot({ path: screenshotPath });
              }
            } catch (e) {
              logger.info(`❌ 方法0.5 (点击拖拽提示区域) 步骤发生意外错误: ${e.message}`);
              const screenshotPath = path.join(process.cwd(), 'data', 'temp', `debug-upload-method0-5-overall-failure-${Date.now()}.png`);
              await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
              await page.screenshot({ path: screenshotPath });
            }
          }

          // --- 方法1 (备选): 直接操作 .upload-input (使用 setInputFiles) ---
          if (!uploadSuccess) {
            logger.info('尝试方法1: 直接操作 .upload-input 使用 setInputFiles');
            try {
              const inputSelector = '.upload-input';
              // 对于 setInputFiles，元素不一定需要可见，但必须存在于DOM中
              await page.waitForSelector(inputSelector, { state: 'attached', timeout: 5000 });
              logger.info(`找到 '${inputSelector}'. 尝试通过 setInputFiles 设置文件...`);
              await page.setInputFiles(inputSelector, absoluteImages, { timeout: 10000 });
              logger.info(`已通过 setInputFiles 为 '${inputSelector}' 设置文件: ${absoluteImages}`);
              uploadSuccess = true; // 假设 setInputFiles 成功即代表文件已选择
              logger.info('✅ 方法1成功: 直接通过 setInputFiles 操作 .upload-input');
            } catch (e) {
              logger.info(`❌ 方法1 (setInputFiles on .upload-input) 失败: ${e.message}`);
              const screenshotPath = path.join(process.cwd(), 'data', 'temp', `debug-upload-input-set-files-failed-${Date.now()}.png`);
              await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
              await page.screenshot({ path: screenshotPath });
            }
          }

          // --- 方法3 (备选): JavaScript直接触发隐藏的input点击 ---
          if (!uploadSuccess) {
            logger.info('尝试方法3: JavaScript点击隐藏的 .upload-input');
            try {
              const inputSelector = '.upload-input';
              await page.waitForSelector(inputSelector, { state: 'attached', timeout: 5000 });
              logger.info(`找到 '${inputSelector}'. 尝试通过JS点击...`);

              const [fileChooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 10000 }),
                page.evaluate((selector) => {
                  document.querySelector(selector).click();
                }, inputSelector)
              ]);

              logger.info(`已通过JS点击 '${inputSelector}'. 文件选择器已出现`);
              await fileChooser.setFiles(absoluteImages);
              logger.info(`已通过文件选择器 (JS点击后) 设置文件: ${absoluteImages}`);
              uploadSuccess = true;
              logger.info('✅ 方法3成功: JavaScript点击 .upload-input 并设置文件');
            } catch (e) {
              logger.info(`❌ 方法3 (JavaScript点击 .upload-input) 失败: ${e.message}`);
              const screenshotPath = path.join(process.cwd(), 'data', 'temp', `debug-upload-js-input-click-failed-${Date.now()}.png`);
              await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
              await page.screenshot({ path: screenshotPath });
            }
          }

          // --- 上传后检查 ---
          if (uploadSuccess) {
            logger.info('图片已通过某种方法设置/点击，进入上传后检查流程，等待处理和预览...');
            await page.waitForTimeout(7000);  // 增加等待时间，等待图片在前端处理和预览

            const uploadCheckJs = `
              () => {
                const indicators = [
                  '.img-card', '.image-preview', '.uploaded-image',
                  '.upload-success', '[class*="preview"]', 'img[src*="blob:"]',
                  '.banner-img', '.thumbnail', '.upload-display-item',
                  '.note-image-item', /*小红书笔记图片项*/
                  '.preview-item', /*通用预览项*/
                  '.gecko-modal-content img' /* 可能是某种弹窗内的预览 */
                ];
                let foundVisible = false;
                logger.info("JS: Checking for upload indicators...");
                for (let selector of indicators) {
                  const elements = document.querySelectorAll(selector);
                  if (elements.length > 0) {
                    for (let el of elements) {
                      const rect = el.getBoundingClientRect();
                      const style = getComputedStyle(el);
                      if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                        logger.info("JS: Found visible indicator:", selector, el);
                        foundVisible = true;
                        break;
                      }
                    }
                  }
                  if (foundVisible) break;
                }
                logger.info("JS: Upload indicator check result (foundVisible):", foundVisible);
                return foundVisible;
              }
            `;

            logger.info('执行JS检查图片预览...');
            const uploadCheckSuccessful = await page.evaluate(uploadCheckJs);

            if (uploadCheckSuccessful) {
              logger.info('✅ 图片上传并处理成功 (检测到可见的预览元素)');
            } else {
              logger.info('⚠️ 图片可能未成功处理或预览未出现(JS检查失败)，请检查截图');
              const screenshotPath = path.join(process.cwd(), 'data', 'temp', `debug-upload-preview-missing-after-js-check-${Date.now()}.png`);
              await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
              await page.screenshot({ path: screenshotPath });
              logger.info('📸 已保存截图:', screenshotPath);
            }
          } else {
            logger.info('❌ 所有主要的图片上传方法均失败。无法进行预览检查。');
            const screenshotPath = path.join(process.cwd(), 'data', 'temp', `debug-upload-all-methods-failed-final-${Date.now()}.png`);
            await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
            await page.screenshot({ path: screenshotPath });
            logger.info('📸 已保存截图:', screenshotPath);
          }

        } catch (e) {
          logger.info(`整个图片上传过程出现严重错误: ${e.message}`);
          logger.error(e.stack);
          const screenshotPath = path.join(process.cwd(), 'data', 'temp', `debug-image-upload-critical-error-outer-${Date.now()}.png`);
          await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
          await page.screenshot({ path: screenshotPath });
          logger.info('📸 已保存截图:', screenshotPath);
        }
      }

      // 输入标题和内容
      logger.info('--- 开始输入标题和内容 ---');
      await page.waitForTimeout(5000);  // 给更多时间让编辑界面加载

      // 输入标题
      logger.info('✍️ 输入标题...');
      try {
        // 使用具体的标题选择器
        const titleSelectors = [
          "input.d-text[placeholder='填写标题会有更多赞哦～']",
          'input.d-text',
          "input[placeholder='填写标题会有更多赞哦～']",
          'input.title',
          "[data-placeholder='标题']",
          "[contenteditable='true']:first-child",
          '.note-editor-wrapper input',
          '.edit-wrapper input'
        ];

        let titleFilled = false;
        for (const selector of titleSelectors) {
          try {
            logger.info(`尝试标题选择器: ${selector}`);
            await page.waitForSelector(selector, { timeout: 5000 });
            await page.fill(selector, title);
            logger.info(`✅ 标题输入成功，使用选择器: ${selector}`);
            titleFilled = true;
            break;
          } catch (e) {
            logger.info(`标题选择器 ${selector} 失败: ${e.message}`);
          }
        }

        if (!titleFilled) {
          // 尝试使用键盘快捷键输入
          try {
            await page.keyboard.press('Tab');
            await page.keyboard.type(title);
            logger.info('✅ 使用键盘输入标题');
          } catch (e) {
            logger.info(`键盘输入标题失败: ${e.message}`);
            logger.info('⚠️ 无法输入标题');
          }
        }
      } catch (e) {
        logger.info(`标题输入失败: ${e.message}`);
      }

      // 输入内容
      logger.info('✍️ 输入内容...');
      try {
        // 尝试更多可能的内容选择器
        const contentSelectors = [
          "[contenteditable='true']:nth-child(2)",
          '.note-content',
          "[data-placeholder='添加正文']",
          "[role='textbox']",
          '.DraftEditor-root'
        ];

        let contentFilled = false;
        for (const selector of contentSelectors) {
          try {
            logger.info(`尝试内容选择器: ${selector}`);
            await page.waitForSelector(selector, { timeout: 5000 });
            await page.fill(selector, content);
            logger.info(`✅ 内容输入成功，使用选择器: ${selector}`);
            contentFilled = true;
            break;
          } catch (e) {
            logger.info(`内容选择器 ${selector} 失败: ${e.message}`);
          }
        }

        if (!contentFilled) {
          // 尝试使用键盘快捷键输入
          try {
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
            await page.keyboard.type(content);
            logger.info('✅ 使用键盘输入内容');
          } catch (e) {
            logger.info(`键盘输入内容失败: ${e.message}`);
            logger.info('⚠️ 无法输入内容');
          }
        }
      } catch (e) {
        logger.info(`内容输入失败: ${e.message}`);
      }

      // 点击发布按钮
      logger.info('📤 点击发布按钮...');
      try {
        // 尝试多种方式查找发布按钮
        const publishButtonSelectors = [
          'button:has-text("发布")',
          'button[type="submit"]',
          '.publish-btn',
          '.submit-btn',
          '[class*="publish"]',
          '[class*="submit"]'
        ];

        let publishButtonClicked = false;
        for (const selector of publishButtonSelectors) {
          try {
            logger.info(`尝试发布按钮选择器: ${selector}`);
            const publishButton = await page.$(selector);
            if (publishButton) {
              await publishButton.click();
              logger.info(`✅ 已点击发布按钮: ${selector}`);
              publishButtonClicked = true;
              break;
            }
          } catch (e) {
            logger.info(`发布按钮选择器 ${selector} 失败: ${e.message}`);
          }
        }

        if (!publishButtonClicked) {
          // 截图以便调试
          const screenshotPath = path.join(process.cwd(), 'data', 'temp', `no-publish-button-final-${Date.now()}.png`);
          await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
          await page.screenshot({ path: screenshotPath, fullPage: true });
          logger.info('📸 未找到发布按钮，已保存截图:', screenshotPath);

          await browser.close();
          return {
            success: false,
            error: '未找到发布按钮'
          };
        }
      } catch (e) {
        logger.info(`点击发布按钮失败: ${e.message}`);
        const screenshotPath = path.join(process.cwd(), 'data', 'temp', `publish-button-error-${Date.now()}.png`);
        await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.info('📸 已保存截图:', screenshotPath);

        await browser.close();
        return {
          success: false,
          error: '点击发布按钮失败'
        };
      }

      // 等待发布完成 - 检查成功标识
      logger.info('⏳ 等待发布完成...');
      try {
        // 等待成功提示或页面跳转（最多等待30秒）
        await Promise.race([
          page.waitForSelector('text=发布成功', { timeout: 30000 }),
          page.waitForSelector('.success', { timeout: 30000 }),
          page.waitForURL(/.*\/publish\/success.*/, { timeout: 30000 })
        ]);

        logger.info('✅ 发布成功！');

        // 尝试从URL中提取note_id
        let noteId = null;
        try {
          await page.waitForTimeout(2000); // 等待页面稳定
          const currentUrl = page.url();
          logger.info('当前URL:', currentUrl);

          // 小红书笔记URL格式通常是: https://www.xiaohongshu.com/explore/[note_id]
          // 或者创作者中心可能是: https://creator.xiaohongshu.com/publish/success?id=[note_id]
          const noteIdMatch = currentUrl.match(/\/explore\/([a-zA-Z0-9]+)|[?&]id=([a-zA-Z0-9]+)|\/note\/([a-zA-Z0-9]+)/);
          if (noteIdMatch) {
            noteId = noteIdMatch[1] || noteIdMatch[2] || noteIdMatch[3];
            logger.info('✅ 提取到note_id:', noteId);
          } else {
            logger.info('⚠️ 未能从URL提取note_id');
          }
        } catch (extractError) {
          logger.info('提取note_id失败:', extractError.message);
        }

        await browser.close();
        return {
          success: true,
          data: {
            message: '发布成功',
            account_id: accountId,
            account_name: account.account_name,
            note_id: noteId,
            status: 'published'
          }
        };
      } catch (waitError) {
        // 如果没有找到成功标识，检查是否有错误提示
        const errorElement = await page.$('.error, .error-message, [class*="error"]');
        if (errorElement) {
          const errorText = await errorElement.textContent();
          await browser.close();
          return {
            success: false,
            error: `发布失败: ${errorText}`
          };
        }

        // 截图保存以便调试
        const screenshotPath = path.join(process.cwd(), 'data', 'temp', `publish-error-${Date.now()}.png`);
        await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.info('📸 已保存截图:', screenshotPath);

        await browser.close();
        return {
          success: false,
          error: '发布超时或未检测到成功标识，请检查截图'
        };
      }

    } catch (error) {
      logger.error('❌ 发布失败:', error);
      // 截图用于调试
      try {
        if (page) {
          const screenshotPath = path.join(process.cwd(), 'data', 'temp', `error-screenshot-${Date.now()}.png`);
          await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
          await page.screenshot({ path: screenshotPath });
          logger.info('📸 已保存错误截图:', screenshotPath);
        }
      } catch (screenshotError) {
        logger.info('截图失败:', screenshotError.message);
      }

      if (browser) {
        await browser.close();
      }
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new MultiAccountPublishService();
