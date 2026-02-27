/**
 * 小红书热门笔记抓取服务
 *
 * 功能：
 * - 抓取指定关键词的热门笔记
 * - 处理Cookie认证
 * - 解析笔记数据
 * - 错误处理和重试机制
 * - 集成缓存系统
 *
 * 参考：xhs-ai-writer 热门笔记抓取实现
 */

import axios from 'axios';
import accountManagementService from './accountManagementService.js';

// 小红书API配置
const XHS_CONFIG = {
  API_URL: 'https://edith.xiaohongshu.com/api/sns/web/v1/search/notes',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  TARGET_NOTES_COUNT: 40,  // 目标抓取笔记数量
  MAX_PAGES: 2,            // 最多抓取页数
  TIMEOUT: 15000           // 请求超时时间（毫秒）
};

/**
 * 生成追踪ID
 * @param {number} length - ID长度
 * @returns {string} 追踪ID
 */
function generateTraceId(length = 32) {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 小红书抓取服务类
 */
class XhsScraperService {
  constructor() {
    this.cookie = process.env.XHS_COOKIE || '';
    this.debugEnabled = process.env.ENABLE_DEBUG_LOGGING === 'true';
  }

  /**
   * 获取Cookie（优先使用登录账户的主站Cookie）
   * @returns {string} Cookie字符串
   */
  getCookie() {
    try {
      // 优先使用当前活跃账户的主站Cookie
      const activeAccount = accountManagementService.getActiveAccount();
      if (activeAccount && activeAccount.main_site_cookies) {
        const cookies = accountManagementService.getMainSiteCookies(activeAccount.id);
        if (cookies && cookies.length > 0) {
          // 将Playwright格式的cookies转换为字符串格式
          const cookieString = cookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');
          console.log(`🔑 使用账户 "${activeAccount.account_name}" 的主站Cookie (${cookies.length}个)`);
          return cookieString;
        }
      }

      // 如果没有主站Cookie，尝试使用第一个已登录主站的账户
      const allAccounts = accountManagementService.getAllAccounts();
      const mainSiteLoggedInAccount = allAccounts.find(acc => acc.main_site_login_status === 'logged_in');
      if (mainSiteLoggedInAccount) {
        const cookies = accountManagementService.getMainSiteCookies(mainSiteLoggedInAccount.id);
        if (cookies && cookies.length > 0) {
          const cookieString = cookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');
          console.log(`🔑 使用账户 "${mainSiteLoggedInAccount.account_name}" 的主站Cookie (${cookies.length}个)`);
          return cookieString;
        }
      }

      // 最后使用环境变量中的Cookie
      if (this.cookie) {
        console.log('🔑 使用环境变量中的Cookie');
        return this.cookie;
      }

      console.log('⚠️ 未找到可用的Cookie');
      return '';
    } catch (error) {
      console.error('❌ 获取Cookie失败:', error.message);
      // 降级到环境变量Cookie
      return this.cookie;
    }
  }

  /**
   * 抓取热门笔记
   * @param {string} keyword - 搜索关键词
   * @param {number} targetCount - 目标笔记数量
   * @returns {Promise<Array>} 笔记列表
   */
  async scrapeHotPosts(keyword, targetCount = XHS_CONFIG.TARGET_NOTES_COUNT) {
    // 动态获取Cookie
    const cookie = this.getCookie();
    if (!cookie) {
      throw new Error('未找到可用的Cookie，请先登录小红书账号');
    }

    console.log(`🔍 开始抓取关键词"${keyword}"的热门笔记（目标${targetCount}篇）`);

    try {
      let allNotes = [];
      let page = 1;

      while (allNotes.length < targetCount && page <= XHS_CONFIG.MAX_PAGES) {
        console.log(`📄 正在抓取第${page}页...`);

        const pageNotes = await this.fetchNotesPage(keyword, page);

        if (pageNotes.length === 0) {
          console.log('⚠️ 当前页没有更多笔记，停止抓取');
          break;
        }

        allNotes = allNotes.concat(pageNotes);
        console.log(`✅ 第${page}页抓取成功，获得${pageNotes.length}篇笔记，累计${allNotes.length}篇`);

        page++;

        // 添加延迟，避免请求过快
        if (page <= XHS_CONFIG.MAX_PAGES && allNotes.length < targetCount) {
          await this.delay(2000); // 延迟2秒
        }
      }

      // 取前N篇笔记
      const finalNotes = allNotes.slice(0, targetCount);
      console.log(`🎉 抓取完成，共获得${finalNotes.length}篇笔记`);

      return this.processNotes(finalNotes);
    } catch (error) {
      console.error('❌ 抓取热门笔记失败:', error.message);
      throw new Error(`抓取失败: ${error.message}`);
    }
  }

  /**
   * 抓取单页笔记
   * @param {string} keyword - 搜索关键词
   * @param {number} page - 页码
   * @returns {Promise<Array>} 笔记列表
   */
  async fetchNotesPage(keyword, page) {
    // 动态获取Cookie
    const cookie = this.getCookie();

    const requestData = {
      keyword: keyword,
      page: page,
      page_size: 20,
      search_id: generateTraceId(21),
      sort: 'popularity_descending', // 热门排序
      note_type: 0, // 不限类型
      ext_flags: [],
      filters: [
        {
          tags: ['popularity_descending'],
          type: 'sort_type'
        },
        {
          tags: ['不限'],
          type: 'filter_note_type'
        },
        {
          tags: ['不限'],
          type: 'filter_note_time'
        },
        {
          tags: ['不限'],
          type: 'filter_note_range'
        },
        {
          tags: ['不限'],
          type: 'filter_pos_distance'
        }
      ],
      geo: '',
      image_formats: ['jpg', 'webp', 'avif']
    };

    const headers = {
      'authority': 'edith.xiaohongshu.com',
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'cache-control': 'no-cache',
      'content-type': 'application/json;charset=UTF-8',
      'origin': 'https://www.xiaohongshu.com',
      'pragma': 'no-cache',
      'referer': 'https://www.xiaohongshu.com/',
      'sec-ch-ua': '"Not A(Brand";v="99", "Microsoft Edge";v="121", "Chromium";v="121"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': XHS_CONFIG.USER_AGENT,
      'x-b3-traceid': generateTraceId(),
      'cookie': cookie
    };

    try {
      const response = await axios.post(XHS_CONFIG.API_URL, requestData, {
        headers,
        timeout: XHS_CONFIG.TIMEOUT
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = response.data;

      if (this.debugEnabled) {
        console.log(`📊 第${page}页API响应:`, {
          success: data.success,
          msg: data.msg,
          itemsCount: data.data?.items?.length || 0
        });
      }

      if (!data.success) {
        throw new Error(`小红书API错误: ${data.msg || '未知错误'}`);
      }

      if (!data.data || !data.data.items) {
        throw new Error('API响应数据结构异常');
      }

      // 过滤出笔记类型的内容
      const notes = data.data.items.filter(item => item.model_type === 'note');

      return notes;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('请求超时');
      }
      throw error;
    }
  }

  /**
   * 处理笔记数据
   * @param {Array} notes - 原始笔记数据
   * @returns {Array} 处理后的笔记数据
   */
  processNotes(notes) {
    return notes.map(item => {
      const noteCard = item.note_card;
      const title = noteCard?.display_title || noteCard?.title || item.display_title || item.title || '无标题';
      const desc = noteCard?.desc || item.desc || '无描述';
      const interactInfo = noteCard?.interact_info || item.interact_info || {
        liked_count: 0,
        comment_count: 0,
        collected_count: 0
      };
      const userInfo = noteCard?.user || item.user || { nickname: '未知用户' };

      return {
        title,
        desc,
        interact_info: {
          liked_count: interactInfo.liked_count || 0,
          comment_count: interactInfo.comment_count || 0,
          collected_count: interactInfo.collected_count || 0
        },
        note_id: item.id || item.note_id || '',
        user_info: {
          nickname: userInfo.nickname || '未知用户'
        }
      };
    });
  }

  /**
   * 格式化笔记数据为文本
   * @param {string} keyword - 关键词
   * @param {Array} notes - 笔记列表
   * @returns {string} 格式化的文本
   */
  formatNotesAsText(keyword, notes) {
    let result = `关键词"${keyword}"的热门笔记分析（共${notes.length}篇）：\n\n`;

    notes.forEach((note, index) => {
      result += `${index + 1}. 标题：${note.title}\n`;
      result += `   描述：${note.desc.substring(0, 100)}${note.desc.length > 100 ? '...' : ''}\n`;
      result += `   互动：点赞${note.interact_info.liked_count} 评论${note.interact_info.comment_count} 收藏${note.interact_info.collected_count}\n`;
      result += `   作者：${note.user_info.nickname}\n\n`;
    });

    return result;
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查Cookie是否有效
   * @returns {boolean} Cookie是否配置
   */
  hasCookie() {
    return !!this.cookie && this.cookie.length > 0;
  }
}

// 导出单例
export default new XhsScraperService();
