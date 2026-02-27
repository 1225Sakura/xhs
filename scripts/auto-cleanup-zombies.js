#!/usr/bin/env node

/**
 * 自动清理 MCP 容器僵尸进程
 *
 * 功能：
 * - 定期检查 MCP 容器内的僵尸进程数量
 * - 如果超过阈值，自动重启容器
 * - 记录清理日志
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  containerName: 'xhs-mcp-server',
  zombieThreshold: 10,  // 僵尸进程阈值
  checkInterval: 60000,  // 检查间隔（毫秒）- 1分钟
  logFile: path.join(__dirname, '../logs/zombie-cleanup.log'),
};

// 日志函数
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;

  console.log(logMessage.trim());

  // 写入日志文件
  try {
    fs.appendFileSync(CONFIG.logFile, logMessage);
  } catch (error) {
    console.error('写入日志失败:', error.message);
  }
}

// 检查僵尸进程数量
async function checkZombieProcesses() {
  try {
    const { stdout } = await execAsync(
      `docker exec ${CONFIG.containerName} ps aux | grep defunct | wc -l`
    );

    const zombieCount = parseInt(stdout.trim(), 10);
    return zombieCount;
  } catch (error) {
    log(`检查僵尸进程失败: ${error.message}`, 'ERROR');
    return -1;
  }
}

// 重启容器
async function restartContainer() {
  try {
    log(`开始重启容器: ${CONFIG.containerName}`, 'WARN');

    await execAsync(`docker restart ${CONFIG.containerName}`);

    log(`容器重启成功: ${CONFIG.containerName}`, 'INFO');

    // 等待容器完全启动
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 验证容器状态
    const { stdout } = await execAsync(`docker ps | grep ${CONFIG.containerName}`);
    if (stdout.includes('Up')) {
      log('容器状态验证成功', 'INFO');
      return true;
    } else {
      log('容器状态验证失败', 'ERROR');
      return false;
    }
  } catch (error) {
    log(`重启容器失败: ${error.message}`, 'ERROR');
    return false;
  }
}

// 主循环
async function mainLoop() {
  log('僵尸进程自动清理服务已启动', 'INFO');
  log(`配置: 阈值=${CONFIG.zombieThreshold}, 检查间隔=${CONFIG.checkInterval}ms`, 'INFO');

  while (true) {
    try {
      const zombieCount = await checkZombieProcesses();

      if (zombieCount === -1) {
        log('无法检查僵尸进程，跳过本次检查', 'WARN');
      } else if (zombieCount > CONFIG.zombieThreshold) {
        log(`⚠️ 检测到 ${zombieCount} 个僵尸进程（阈值: ${CONFIG.zombieThreshold}）`, 'WARN');
        log('触发自动清理...', 'WARN');

        const success = await restartContainer();

        if (success) {
          // 重启后再次检查
          await new Promise(resolve => setTimeout(resolve, 5000));
          const newZombieCount = await checkZombieProcesses();
          log(`✅ 清理完成，当前僵尸进程数: ${newZombieCount}`, 'INFO');
        } else {
          log('❌ 清理失败，请手动检查', 'ERROR');
        }
      } else {
        log(`✓ 僵尸进程数正常: ${zombieCount}`, 'INFO');
      }

      // 等待下次检查
      await new Promise(resolve => setTimeout(resolve, CONFIG.checkInterval));
    } catch (error) {
      log(`主循环错误: ${error.message}`, 'ERROR');
      // 出错后等待一段时间再继续
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
}

// 启动服务
log('='.repeat(60), 'INFO');
log('MCP 容器僵尸进程自动清理服务', 'INFO');
log('='.repeat(60), 'INFO');

mainLoop().catch(error => {
  log(`服务崩溃: ${error.message}`, 'ERROR');
  process.exit(1);
});

// 优雅退出
process.on('SIGINT', () => {
  log('收到退出信号，正在关闭服务...', 'INFO');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('收到终止信号，正在关闭服务...', 'INFO');
  process.exit(0);
});
