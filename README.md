# 🎯 Methodalgo Market Intelligence CLI

> **Methodalgo 市场情报工具** - 专为开发者和大模型 (LLM) 优化的加密货币市场分析命令行工具。

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![I18n: Supported](https://img.shields.io/badge/i18n-zh%20%7C%20en-blue)](https://github.com/methodalgo/methodalgo-cli)

---

## ✨ 核心特性

- 🚀 **瞬时快照**：一键获取 TradingView 实时图表快照 (iTerm2 支持直渲)。
- 📰 **深度新闻**：聚合全球加密市场新闻，并提供 AI 摘要（需服务端支持）。
- 📊 **L2 信号**：实时监控特定频道的交易信号（如 Golden Pit 等）。
- 🖥️ **TUI 仪表盘**：全屏实时监控 (TUI)，包含全球时钟及多维数据流。
- 🌍 **国际化支持**：完整的中英文双语切换，默认为英文环境。
- 🤖 **LLM 友好**：针对大模型工作流优化的输出格式，包含清晰的错误修复建议 (Suggestions)。
- 🔒 **安全加固**：交互式 Onboarding 引导流程，且所有 API Key 设置均经过实时联网强校验。

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

第一次运行 `methodalgo` 时，系统会自动进入 **交互式引导 (Onboarding)** 流程，帮助您选择语言并验证 API Key。您也可以手动进行调整：

```bash
# 设置并校验 API Key (联网验证通过后才保存)
methodalgo config set api-key your_ma_key_here

# 切换语言为中文 (默认为 en)
methodalgo config set lang zh

# 查看当前配置 (敏感信息已掩码)
methodalgo config list
```

---

## 🖼️ 图片渲染说明 (MacOS 专用)

本项目支持在 **iTerm2** 终端中直接显示图表快照，无需打开浏览器。

- **自动直渲**：在 iTerm2 中运行 `methodalgo snapshot` 会自动请求二进制数据流并渲染图片。
- **云端回退**：在非 iTerm2 环境下，会自动返回 Web 预览链接。
- **强制模式**：
  - 使用 `-u, --url` 强制返回链接 (LLM 调用推荐)。
  - 使用 `-b, --buffer` 强制尝试终端渲染。

---

## 🚀 指令手册

### 📸 获取图表快照 (Snapshot)
获取指定交易对和周期的 TradingView 预览图。

```bash
# 获取 SOLUSDT 的 1 小时快照 (iTerm2 会直接显示图片)
methodalgo snapshot SOLUSDT 60

# 强制获取 URL 链接 (即使在 iTerm2 中)
methodalgo snapshot BTCUSDT --url

# 强制获取二进制流并尝试渲染
methodalgo snapshot ETHUSDT --buffer

# 输出原始 JSON 数据
methodalgo snapshot BTCUSDT --json
```

### 📰 获取市场新闻 (News)
获取实时加密市场情报，支持关键词搜索和日期范围筛选。

```bash
# 获取最新的 5 条实时快讯
methodalgo news --type breaking --limit 5

# 搜索包含 "Bitcoin" 的新闻
methodalgo news --search "Bitcoin"

# 筛选指定日期范围的新闻
methodalgo news --start-date "2026-03-20" --end-date "2026-03-25"

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

### 🖥️ 实时仪表盘 (Dashboard)
启动全屏 TUI 模式，实时监控全球资讯与 Alpha 信号。

```bash
# 启动仪表盘
methodalgo dashboard
```

### 🔓 注销登录 (Logout)
安全移除本地 API Key 信息（保留语言偏好）。

```bash
methodalgo logout
```

---

## 📂 项目结构

```text
methodalgo-cli/
├── src/
│   ├── index.js          # CLI 入口逻辑 (含 Onboarding 控制)
│   ├── commands/         # 各子指令实现 (config, news, snapshot, signals, dashboard, logout)
│   └── utils/
│       ├── api.js        # 签名请求封装 (含 Key 强校验)
│       ├── i18n.js       # 国际化翻译字典
│       ├── onboard.js    # 交互式引导流程
│       ├── config-manager.js # 本地配置持久化
│       └── logger.js     # 特色日志工具
├── package.json
└── README.md
```

---

## 📜 许可证

本项目基于 [MIT License](LICENSE) 开源。
