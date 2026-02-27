const express = require('express');
const router = express.Router();
const clientController = require('../controllers/cloudClientController');
const configController = require('../controllers/cloudConfigController');
const syncController = require('../controllers/cloudSyncController');
const licenseController = require('../controllers/licenseController');
const userController = require('../controllers/userController');
const { authenticate, requireRole, authenticateClient } = require('../middleware/auth');

// 公开路由（无需认证）
router.post('/auth/login', userController.login);
router.post('/auth/register', userController.register);
router.post('/license/verify', licenseController.verify);
router.get('/license/public-key', licenseController.getPublicKey);

// 客户端路由（需要客户端认证）
router.post('/clients/register', authenticateClient, clientController.register);
router.post('/clients/heartbeat', authenticateClient, clientController.heartbeat);
router.get('/config/:clientId', authenticateClient, configController.getConfig);
router.post('/sync/upload', authenticateClient, syncController.upload);
router.get('/sync/download/:clientId', authenticateClient, syncController.download);
router.post('/metrics', authenticateClient, syncController.uploadMetrics);

// 用户路由（需要用户认证）
router.get('/auth/me', authenticate, userController.getCurrentUser);
router.post('/auth/change-password', authenticate, userController.changePassword);

// 管理员路由（需要管理员权限）
router.get('/clients', authenticate, requireRole('admin'), clientController.list);
router.get('/clients/:clientId', authenticate, requireRole('admin'), clientController.getById);
router.delete('/clients/:clientId', authenticate, requireRole('admin'), clientController.delete);
router.put('/config/:clientId', authenticate, requireRole('admin'), configController.updateConfig);
router.get('/metrics/:clientId', authenticate, requireRole('admin'), syncController.getMetrics);

// 许可证管理路由（需要管理员权限）
router.post('/license', authenticate, requireRole('admin'), licenseController.create);
router.get('/license/:licenseKey', authenticate, requireRole('admin'), licenseController.get);
router.put('/license/:licenseKey', authenticate, requireRole('admin'), licenseController.update);

// 用户管理路由（需要管理员权限）
router.get('/users', authenticate, requireRole('admin'), userController.list);
router.put('/users/:userId', authenticate, requireRole('admin'), userController.update);
router.delete('/users/:userId', authenticate, requireRole('admin'), userController.delete);
router.get('/audit-logs', authenticate, requireRole('admin'), userController.getAuditLogs);

module.exports = router;
