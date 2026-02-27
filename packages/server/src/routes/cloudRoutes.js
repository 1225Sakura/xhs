const express = require('express');
const router = express.Router();
const clientController = require('../controllers/cloudClientController');
const configController = require('../controllers/cloudConfigController');
const syncController = require('../controllers/cloudSyncController');

// 客户端管理路由
router.post('/clients/register', clientController.register);
router.post('/clients/heartbeat', clientController.heartbeat);
router.get('/clients', clientController.list);
router.get('/clients/:clientId', clientController.getById);
router.delete('/clients/:clientId', clientController.delete);

// 配置管理路由
router.get('/config/:clientId', configController.getConfig);
router.put('/config/:clientId', configController.updateConfig);

// 数据同步路由
router.post('/sync/upload', syncController.upload);
router.get('/sync/download/:clientId', syncController.download);

// 指标路由
router.post('/metrics', syncController.uploadMetrics);
router.get('/metrics/:clientId', syncController.getMetrics);

module.exports = router;
