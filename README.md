# 🚀 Methodalgo CLI

[English](#english) | [中文](#中文)

---

<a name="english"></a>
## English

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)

> **Ultra-fast, professional, cross-platform crypto market intelligence terminal.**
> An Alpha signal fetcher specially designed for traders and AI agents.

### Project Overview
`methodalgo-cli` is a lightweight market intelligence command-line tool based on Node.js. It allows end-users to quickly obtain snapshots, news, and signals from the cryptocurrency market, and is deeply optimized for AI agent (LLM) workflows.

### 🛠️ Installation Guide

#### 🌟 Recommended: NPM Global Install
This is the fastest and easiest way to upgrade. Ensure [Node.js](https://nodejs.org/) (v20+) is installed on your system:
```bash
npm install -g methodalgo-cli
```

#### 📦 Other Installation Methods

**1. Standalone Binary (No Node.js Required)**
Download the binary for your platform from [Releases](https://github.com/methodalgo/methodalgo-cli/releases). To make it globally accessible:
- **macOS / Linux**: Move the binary to `/usr/local/bin` and rename it to `methodalgo`:
  ```bash
  sudo mv methodalgo-macos-arm64 /usr/local/bin/methodalgo
  sudo chmod +x /usr/local/bin/methodalgo
  ```
- **Windows**: Add the folder containing `methodalgo-win-x64.exe` to your [System Environment Variables](https://www.google.com/search?q=how+to+add+to+path+windows).

**2. Install from Source**
```bash
git clone https://github.com/methodalgo/methodalgo-cli.git
cd methodalgo-cli
npm install
npm link        # Link local command
```

---
#### 🖥️ Market Dashboard (`dashboard`)
Launch a real-time TUI (Terminal User Interface) dashboard for a global view of market insights, news, and signals.

*   **Usage**: `methodalgo dashboard` (Alias: `top`)
*   **Controls**: Use `TAB` to switch panels, `UP/DOWN` to scroll, and `ENTER` to view details.

**Example**: `methodalgo dashboard`

### ⚙️ Commands

#### 📸 Market Snapshot (`snapshot`)
Get a real-time TradingView chart snapshot for a specific symbol.

*   **Usage**: `methodalgo snapshot <symbol> [options]`
*   **Options**:
    *   `-t, --tf <timeframe>`: Timeframe (e.g., 1, 15, 60, 4h, D) (Default: "60")
    *   `--json`: Output WebP image URL in JSON format.
    *   `--url`: Force URL output only (do not attempt terminal rendering).

**Example**: `methodalgo snapshot BTCUSDT --json`

**💡 Response Preview**
- **Standard Mode (iTerm2)**: High-definition WebP chart rendered directly in terminal.
- **JSON Mode**: 
```json
{
  "url": "https://m.methodalgo.com/tmp/1774563764359.webp"
}
```

#### 📡 Trading Signals (`signals`)
Fetch the latest Alpha signals or market indices from specified channels.

*   **Usage**: `methodalgo signals [channel] [options]`
*   **Popular Channels**:
    *   `etf-tracker`: Real-time daily inflow/outflow details for BTC/ETH ETFs.
    *   `market-today`: Daily market summary (Fear & Greed Index, Altcoin Season Index, etc.).
    *   `golden-pit-mtf`: High-quality low-frequency pattern recognition signals.
*   **Options**:
    *   `-l, --limit <number>`: Number of signals to fetch (Default: "10")
    *   `--json`: Output raw signals array in JSON format.

**Example**: `methodalgo signals etf-tracker --limit 1`

**💡 Response Preview**
- **List Mode**:
```text
[Index] Title | Content Summary (Publish Time)
    > Detailed data (e.g., ETF net inflow)
    Original: [URL]
```

#### 📰 Market News (`news`)
Get multi-language crypto market news filtered by AI.

*   **Usage**: `methodalgo news [options]`
*   **News Types**: `breaking`, `article`, `onchain`, `report`
*   **Options**:
    *   `-t, --type <type>`: News category (Default: "breaking")
    *   `-l, --limit <number>`: Result count (Default: "10")
    *   `-g, --language <lang>`: Output language (zh/en) (Default: "zh")
    *   `-s, --search <keyword>`: Search keyword in titles.

**Example**: `methodalgo news --type breaking --limit 1 --json`

**💡 Response Preview**
```json
[
  {
    "type": "news",
    "title": { "zh": "突发：...", "en": "JUST IN: ..." },
    "publish_date": "2026-03-26T22:03:49+00:00",
    "url": "https://..."
  }
]
```


---

### 🚀 Highlights

- ⚡ **Lightning Fast**: Built on Node SEA, millisecond startup time.
- 🖼️ **Terminal Rendering**: Deeply compatible with iTerm2 for previewing snapshots in-terminal.
- 🌍 **Multi-language**: Native support for Chinese and English.
- 🤖 **AI Friendly**: Clean JSON output, perfect for AI Agent integration.

<br/>

---

<a name="中文"></a>
## 中文

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)

> **极速、专业、跨平台的加密货币市场情报终端。** 
> 专为交易者与 AI 代理设计的 Alpha 信号抓取器。

### 项目概览
`methodalgo-cli` 是一个基于 Node.js 开发的轻量级市场情报命令行工具。它不仅能让终端用户快速获取加密货币市场的快照、新闻和信号，还针对 AI 代理（LLM）的工作流进行了深度优化。

### 🛠️ 安装指南

#### 🌟 推荐方式：NPM 全局安装
这是最快速、最易于升级的方式。确保您的系统已安装 [Node.js](https://nodejs.org/) (v20+):
```bash
npm install -g methodalgo-cli
```

#### 📦 其他安装方式

**1. 独立二进制版 (无需 Node.js)**
从 [Releases](https://github.com/methodalgo/methodalgo-cli/releases) 下载对应平台的二进制文件。为了全局调用，建议：
- **macOS / Linux**: 将文件移动到 `/usr/local/bin` 并重命名为 `methodalgo`:
  ```bash
  sudo mv methodalgo-macos-arm64 /usr/local/bin/methodalgo
  sudo chmod +x /usr/local/bin/methodalgo
  ```
- **Windows**: 将包含 `methodalgo-win-x64.exe` 的文件夹路径添加到系统的 [环境变量 PATH](https://www.baidu.com/s?wd=%E5%A6%82%E4%BD%95%E5%B0%86%E6%96%87%E4%BB%B6%E5%A4%B9%E6%B7%BB%E5%8A%A0%E5%88%B0PATH) 中。

**2. 开发源码安装**
```bash
git clone https://github.com/methodalgo/methodalgo-cli.git
cd methodalgo-cli
npm install
npm link        # 链接本地指令
```

---

### ⚙️ 指令指南

#### 📸 市场快照 (`snapshot`)
获取指定交易对的实时 TradingView 图表快照。

*   **用法**: `methodalgo snapshot <symbol> [options]`
*   **选项**:
    *   `-t, --tf <timeframe>`: 时间周期 (如: 1, 15, 60, 4h, D) (默认: "60")
    *   `--json`: 以 JSON 格式输出 WebP 图片 URL。
    *   `--url`: 强制仅输出 URL（不尝试在终端渲染图片）。

**示例**: `methodalgo snapshot BTCUSDT --json`

**💡 响应预览**
- **标准模式 (iTerm2)**: 直接在终端显示高清 WebP 图表。
- **JSON 模式**: 
```json
{
  "url": "https://m.methodalgo.com/tmp/1774563764359.webp"
}
```

#### 📡 交易信号 (`signals`)
从指定频道获取最新的 Alpha 信号或市场指标。

*   **用法**: `methodalgo signals [channel] [options]`
*   **热门频道**:
    *   `etf-tracker`: 监控 BTC/ETH ETF 每日实时资金流入/流出详情。
    *   `market-today`: 每日市场全景总结（包含恐惧贪婪指数、山寨季指数等）。
    *   `golden-pit-mtf`: 低频高质量模式识别信号。
*   **选项**:
    *   `-l, --limit <number>`: 获取信号的数量 (默认: "10")
    *   `--json`: 以 JSON 格式输出原始信号数组。

**示例**: `methodalgo signals etf-tracker --limit 1`

**💡 响应预览**
- **标准模式**:
```text
[序号] 标题 | 核心内容摘要 (发布时间)
    > 详细数据详情 (如 ETF 净流入额)
    查看原文: [URL]
```

#### 📰 市场新闻 (`news`)
获取经过 AI 分选的多语言加密货币市场新闻。

*   **用法**: `methodalgo news [options]`
*   **新闻类型**: `breaking` (快讯), `article` (深度), `onchain` (链上), `report` (报告)
*   **选项**:
    *   `-t, --type <type>`: 新闻分类 (默认: "breaking")
    *   `-l, --limit <number>`: 结果数量 (默认: "10")
    *   `-g, --language <lang>`: 输出语言 (zh/en) (默认: "zh")
    *   `-s, --search <keyword>`: 标题关键词搜索。

**示例**: `methodalgo news --type breaking --limit 1 --json`

**💡 响应预览**
```json
[
  {
    "type": "news",
    "title": { "zh": "突发：...", "en": "JUST IN: ..." },
    "publish_date": "2026-03-26T22:03:49+00:00",
    "url": "https://..."
  }
]
```

#### 🖥️ 市场看板 (`dashboard`)
启动实时 TUI（终端用户界面）仪表盘，全局俯瞰市场洞察、新闻与信号。

*   **用法**: `methodalgo dashboard` (别名: `top`)
*   **操作**: 使用 `TAB` 切换面板，`UP/DOWN` 滚动列表，`ENTER` 弹出详情。

**示例**: `methodalgo dashboard`

---

### 🖥️ 功能亮点

- ⚡ **极致速度**: 基于 Node SEA 打造，启动毫秒级。
- 🖼️ **终端绘图**: 深度适配 iTerm2，无需离开终端即可预览截图。
- 🌍 **多语言**: 原生支持中英双语切换。
- 🤖 **LLM 友好**: 提供结构清晰的 JSON 输出，完美适配 AI Agent 集成。

<br/>

---

*Powered by Methodalgo.*
