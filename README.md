# 🎯 Methodalgo Market Intelligence CLI

> **Methodalgo 市场情报工具** - 专为开发者和大模型 (LLM) 优化的加密货币市场分析命令行工具。

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![I18n: Supported](https://img.shields.io/badge/i18n-zh%20%7C%20en-blue)](https://github.com/methodalgo/methodalgo-cli)

---

## ✨ 核心特性

- 🚀 **瞬时快照**：一键获取 TradingView 实时图表快照。
- 📰 **深度新闻**：聚合全球加密市场新闻，并提供 AI 摘要（需服务端支持）。
- 📊 **Alpha 信号**：实时监控特定频道的交易信号（如 Golden Pit 等）。
- 🌍 **国际化支持**：完整的中英文双语切换，默认为英文环境。
- 🤖 **LLM 友好**：针对大模型工作流优化的输出格式，包含清晰的错误修复建议 (Suggestions)。
- 🔒 **安全加密**：敏感请求均经过 HMAC 签名验证。

---

## 🛠️ 安装指南

确保您的系统中已安装 Node.js (v18+)。

```bash
# 在项目目录中执行 (如果已发布)
# npm install -g @methodalgo/cli

# 本地开发安装
npm install
npm link
```

---

## ⚙️ 配置说明

在使用核心功能前，请先配置您的 API Key。

```bash
# 设置 API Key
methodalgo config set api-key your_ma_key_here

# 切换语言为中文 (默认为 en)
methodalgo config set lang zh

# 查看当前配置 (敏感信息已加密)
methodalgo config list
```

---

## 🚀 指令手册

### 📸 获取图表快照 (Snapshot)
获取指定交易对和周期的 TradingView 预览图。

```bash
# 获取 SOLUSDT 的 1 小时快照
methodalgo snapshot SOLUSDT 60

# 获取预览链接 (JSON 格式输出)
methodalgo snapshot BTCUSDT --json
```

### 📰 获取市场新闻 (News)
获取实时加密市场情报并阅读其核心摘要。

```bash
# 获取最新的 5 条文章类新闻
methodalgo news --type article --limit 5

# 查看原始 JSON 数据以供进一步分析
methodalgo news --json
```

### 📡 获取交易信号 (Signals)
从指定频道获取最新的 Alpha 交易信号信息。

```bash
# 获取默认频道的 2 条信号
methodalgo signals --limit 2

# 指定特定频道
methodalgo signals golden-pit-mtf
```

---

## 📂 项目结构

```text
methodalgo-cli/
├── src/
│   ├── index.js          # CLI 入口逻辑
│   ├── commands/         # 各子指令实现 (config, news, snapshot, signals)
│   └── utils/
│       ├── api.js        # HMAC 签名请求封装
│       ├── i18n.js       # 国际化翻译字典
│       ├── config-manager.js # 本地配置持久化
│       └── logger.js     # 集成 Suggestion 逻辑的日志工具
├── package.json
└── README.md
```

---

## 📜 许可证

本项目基于 [MIT License](LICENSE) 开源。
