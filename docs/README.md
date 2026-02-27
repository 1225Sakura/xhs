# 项目文档索引

## 📚 文档导航

本文档提供项目所有文档的快速导航和说明。

---

## 🏠 根目录文档

### README.md
**主项目文档** - 项目概述、功能特性、快速开始指南
- 核心特性介绍
- 系统架构说明
- 快速开始指南
- API接口概览
- 故障排查指南

### RULES.md
**项目规则文档** - 开发和维护规则
- AI交互执行规则
- 代码规范规则
- 文档管理规则
- Git提交规则

### CLEANUP_SUMMARY.md
**清理总结** - 项目清理记录（2026-02-06）
- 已删除文件列表
- 文档更新记录
- 功能变更说明

---

## 📖 API文档

### docs/api/API_DOCUMENTATION.md
**完整API文档** - 所有API端点的详细说明
- 知识库管理API
- 产品管理API
- 文案生成API
- 发布管理API
- 账号管理API
- 热点数据API
- 系统接口API

---

## 🏗️ 架构文档

### docs/ARCHITECTURE.md
**系统架构文档** - 技术架构和设计说明
- 系统架构图
- 技术栈说明
- 模块设计
- 数据流程

### docs/CONFIGURATION.md
**配置说明文档** - 系统配置详解
- 环境变量配置
- 数据库配置
- AI提供商配置
- 小红书MCP配置

---

## 📘 使用指南

### docs/guides/AUTO_COOKIE_GUIDE.md
**自动Cookie获取指南** - 小红书Cookie自动获取
- 功能��明
- 使用步骤
- 故障排查

### docs/guides/MAIN_SITE_LOGIN_GUIDE.md
**主站登录指南** - 小红书主站登录方法
- 登录流程
- Cookie管理
- 常见问题

### docs/guides/STARTUP_SCRIPTS.md
**启动脚本指南** - 系统启动脚本说明
- 启动脚本使用
- 自动化配置
- 服务管理

### docs/LOGIN_GUIDE.md
**登录指南** - 小红书登录完整指南
- 多种登录方式
- Cookie导入
- 登录验证

### docs/本地登录上传cookies指南.md
**本地Cookie上传指南** - 手动导入Cookie方法
- 获取Cookie步骤
- 上传方法
- 验证测试

---

## ⚙️ 配置指南

### docs/setup/AI_PROVIDER_SETUP.md
**AI提供商配置指南** - AI服务配置详解
- 支持的AI提供商
- 配置步骤
- 优先级设置
- 价格对比
- 故障排查

### docs/setup/ENVIRONMENT_SETUP_COMPLETE.md
**环境配置完成文档** - 环境配置验证
- 配置检查清单
- 验证步骤
- 常见问题

### docs/setup/QUICK_START.md
**快速开始指南** - 快速上手指南
- 安装步骤
- 基本配置
- 首次使用
- 测试验证

---

## 📊 状态文档

### docs/status/SYSTEM_STATUS_2026-02-06.md
**最新系统状态** - 当前系统状态报告
- 核心功能状态
- 最近更新内容
- 性能指标
- 已知问题
- 维护建议

### docs/status/copywriting-optimization-plan.md
**文案优化计划** - AI文案生成优化方案
- 优化目标
- 实施方案
- 效果评估

### docs/status/xhs-scraping-analysis.md
**小红书爬取分析** - 热门笔记爬取分析
- 爬取方法
- 数据分析
- 优化建议

---

## 🔧 其他文档

### docs/MULTI_ACCOUNT.md
**多账号管理文档** - 多账号功能说明
- 账号管理
- 切换方法
- 使用场景

### docs/RALPH_SETUP.md
**Ralph配置文档** - Ralph相关配置
- 配置说明
- 使用方法

### docs/MCP-Inspector使用指南.md
**MCP Inspector指南** - MCP调试工具使用
- 工具介绍
- 使用方法
- 调试技巧

---

## 📁 文档结构

```
docs/
├── api/                    # API文档
│   └── API_DOCUMENTATION.md
├── guides/                 # 使用指南
│   ├── AUTO_COOKIE_GUIDE.md
│   ├── MAIN_SITE_LOGIN_GUIDE.md
│   └── STARTUP_SCRIPTS.md
├── setup/                  # 配置指南
│   ├── AI_PROVIDER_SETUP.md
│   ├── ENVIRONMENT_SETUP_COMPLETE.md
│   └── QUICK_START.md
├── status/                 # 状态文档
│   ├── SYSTEM_STATUS_2026-02-06.md
│   ├── copywriting-optimization-plan.md
│   └── xhs-scraping-analysis.md
├── ARCHITECTURE.md         # 架构文档
├── CONFIGURATION.md        # 配置说明
├── LOGIN_GUIDE.md         # 登录指南
├── MULTI_ACCOUNT.md       # 多账号管理
├── RALPH_SETUP.md         # Ralph配置
├── MCP-Inspector使用指南.md
├── README.md              # 文档总览
└── 本地登录上传cookies指南.md
```

---

## 🔍 快速查找

### 我想...

**开始使用系统**
→ 查看 [README.md](../README.md) 和 [docs/setup/QUICK_START.md](./setup/QUICK_START.md)

**配置AI提供商**
→ 查看 [docs/setup/AI_PROVIDER_SETUP.md](./setup/AI_PROVIDER_SETUP.md)

**了解API接口**
→ 查看 [docs/api/API_DOCUMENTATION.md](./api/API_DOCUMENTATION.md)

**解决登录问题**
→ 查看 [docs/LOGIN_GUIDE.md](./LOGIN_GUIDE.md) 和 [docs/guides/](./guides/)

**查看系统状态**
→ 查看 [docs/status/SYSTEM_STATUS_2026-02-06.md](./status/SYSTEM_STATUS_2026-02-06.md)

**了解系统架构**
→ 查看 [docs/ARCHITECTURE.md](./ARCHITECTURE.md)

**配置环境变量**
→ 查看 [docs/CONFIGURATION.md](./CONFIGURATION.md)

**管理多个账号**
→ 查看 [docs/MULTI_ACCOUNT.md](./MULTI_ACCOUNT.md)

---

## 📝 文档维护

### 文档更新规则
1. 重大功能更新时更新相关文档
2. 每次版本发布时更新状态文档
3. 发现问题时更新故障排查部分
4. 配置变更时更新配置文档

### 文档版本
- 最后更新：2026-02-06
- 当前版本：v2.4
- 维护者：项目团队

---

**文档索引创建时间**: 2026-02-06
**项目版本**: v2.4
