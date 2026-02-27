/**
 * 账户管理路由
 */

import express from 'express';
import accountManagementService from '../services/accountManagementService.js';
import xhsMainSiteLoginService from '../services/xhsMainSiteLoginService.js';

const router = express.Router();

/**
 * 获取所有账户
 */
router.get('/accounts', (req, res) => {
  try {
    const accounts = accountManagementService.getAllAccounts();
    console.log('🔍 getAllAccounts returned:', JSON.stringify(accounts, null, 2));
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取当前活跃账户
 */
router.get('/accounts/active', (req, res) => {
  try {
    const account = accountManagementService.getActiveAccount();
    res.json({
      success: true,
      data: account || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建新账户
 */
router.post('/accounts', (req, res) => {
  try {
    const { account_name, phone } = req.body;

    if (!account_name) {
      return res.status(400).json({
        success: false,
        error: '账户名称不能为空'
      });
    }

    const result = accountManagementService.createAccount(account_name, phone);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 切换活跃账户
 */
router.post('/accounts/:id/switch', (req, res) => {
  try {
    const { id } = req.params;
    const result = accountManagementService.switchAccount(parseInt(id));

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除账户
 */
router.delete('/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = accountManagementService.deleteAccount(parseInt(id));

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取主站登录二维码
 */
router.get('/accounts/main-site/qrcode', (req, res) => {
  xhsMainSiteLoginService.getMainSiteQRCode(req, res);
});

/**
 * 检查主站登录状态
 */
router.get('/accounts/main-site/status', (req, res) => {
  xhsMainSiteLoginService.checkMainSiteLoginStatusAPI(req, res);
});

/**
 * 退出主站登录
 */
router.post('/accounts/:id/logout-main-site', (req, res) => {
  try {
    const { id } = req.params;
    const accountId = parseInt(id);

    // 清除主站cookies和登录状态
    const result = accountManagementService.clearMainSiteLogin(accountId);

    if (result.success) {
      res.json({
        success: true,
        message: '已退出主站登录'
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
