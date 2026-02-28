import express from 'express';
import userController from '../controllers/userController.js';
import clientController from '../controllers/clientController.js';
import { authenticate, requireRole, authenticateClient } from '../middleware/auth.js';

const router = express.Router();

// ============================================
// 公开路由（无需认证）
// ============================================

// 用户认证
router.post('/auth/login', userController.login.bind(userController));
router.post('/auth/register', userController.register.bind(userController));

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '云端API服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ============================================
// 客户端路由（需要客户端认证）
// ============================================

// 客户端注册
router.post('/clients/register', (req, res) => {
  clientController.register(req, res);
});

// 客户端心跳
router.post('/clients/heartbeat', authenticateClient, (req, res) => {
  clientController.heartbeat(req, res);
});

// ============================================
// 用户路由（需要用户认证）
// ============================================

// 获取当前用户信息
router.get('/auth/me', authenticate, (req, res) => {
  userController.getCurrentUser(req, res);
});

// 修改密码
router.post('/auth/change-password', authenticate, (req, res) => {
  userController.changePassword(req, res);
});

// ============================================
// 管理员路由（需要管理员权限）
// ============================================

// 客户端管理
router.get('/clients', authenticate, requireRole('admin'), (req, res) => {
  clientController.list(req, res);
});

router.get('/clients/:clientId', authenticate, requireRole('admin'), (req, res) => {
  clientController.getById(req, res);
});

router.delete('/clients/:clientId', authenticate, requireRole('admin'), (req, res) => {
  clientController.delete(req, res);
});

// 用户管理
router.get('/users', authenticate, requireRole('admin'), (req, res) => {
  userController.list(req, res);
});

router.put('/users/:userId', authenticate, requireRole('admin'), (req, res) => {
  userController.update(req, res);
});

router.delete('/users/:userId', authenticate, requireRole('admin'), (req, res) => {
  userController.delete(req, res);
});

router.get('/audit-logs', authenticate, requireRole('admin'), (req, res) => {
  userController.getAuditLogs(req, res);
});

// ============================================
// 占位路由（待实现功能）
// ============================================

// 许可证管理（待实现）
router.post('/license/verify', (req, res) => {
  res.status(501).json({
    success: false,
    error: '许可证验证功能待实现'
  });
});

router.get('/license/public-key', (req, res) => {
  res.status(501).json({
    success: false,
    error: '许可证公钥获取功能待实现'
  });
});

// 配置同步（待实现）
router.get('/config/:clientId', authenticateClient, (req, res) => {
  res.status(501).json({
    success: false,
    error: '配置同步功能待实现'
  });
});

router.put('/config/:clientId', authenticate, requireRole('admin'), (req, res) => {
  res.status(501).json({
    success: false,
    error: '配置更新功能待实现'
  });
});

// 数据同步（待实现）
router.post('/sync/upload', authenticateClient, (req, res) => {
  res.status(501).json({
    success: false,
    error: '数据上传功能待实现'
  });
});

router.get('/sync/download/:clientId', authenticateClient, (req, res) => {
  res.status(501).json({
    success: false,
    error: '数据下载功能待实现'
  });
});

// 指标收集（待实现）
router.post('/metrics/upload', authenticateClient, (req, res) => {
  res.status(501).json({
    success: false,
    error: '指标上传功能待实现'
  });
});

router.get('/metrics/client/:clientId', authenticate, requireRole('admin'), (req, res) => {
  res.status(501).json({
    success: false,
    error: '客户端指标查询功能待实现'
  });
});

router.get('/metrics/summary', authenticate, requireRole('admin'), (req, res) => {
  res.status(501).json({
    success: false,
    error: '指标汇总功能待实现'
  });
});

// Prometheus指标导出（待实现）
router.get('/metrics', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Prometheus指标导出功能待实现'
  });
});

export default router;
