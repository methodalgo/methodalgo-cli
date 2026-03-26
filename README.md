# 🚀 Methodalgo CLI
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)

> **极速、专业、跨平台的加密货币市场情报终端。** 
> 专为交易者与 AI 代理设计的 Alpha 信号抓取器。

## 项目概览
`methodalgo-cli` 是一个基于 Node.js 开发的轻量级市场情报命令行工具。它不仅能让终端用户快速获取加密货币市场的快照、新闻和信号，还针对 AI 代理（LLM）的工作流进行了深度优化，提供了可解析的错误方案建议。
---

## 🛠️ 安装指南

### 🌟 推荐方式：NPM 全局安装
这是最快速、最易于升级的方式。确保您的系统已安装 [Node.js](https://nodejs.org/) (v20+):
```bash
npm install -g methodalgo-cli
```

### 📦 其他安装方式

#### 1. 独立二进制版 (无需 Node.js)
直接从 [Releases](https://github.com/methodalgo/methodalgo-cli/releases) 下载对应平台的二进制文件并加入系统 `PATH`:
- `methodalgo-macos-arm64` (Apple Silicon)
- `methodalgo-macos-x64` (Intel Mac)
- `methodalgo-win-x64.exe` (Windows)
- `methodalgo-linux-x64` (Linux)

#### 2. 开发源码安装
```bash
git clone https://github.com/methodalgo/methodalgo-cli.git
cd methodalgo-cli
npm install
npm link        # 链接本地指令
```

---

## ⚙️ 指令指南

### 📸 市场快照 (`snapshot`)
获取指定交易对的实时 TradingView 图表快照。

*   **用法**: `methodalgo snapshot <symbol> [options]`
*   **选项**:
    *   `-t, --tf <timeframe>`: 时间周期 (如: 1, 15, 60, 4h, D) (默认: "60")
    *   `--json`: 以 JSON 格式输出 WebP 图片 URL。
    *   `--url`: 强制仅输出 URL（不尝试在终端渲染图片）。

#### 💡 响应预览
**标准模式 (iTerm2)**: 直接在终端显示高清 WebP 图表。
**JSON 模式**: 
```json
{
  "url": "https://m.methodalgo.com/tmp/1774563764359.webp"
}
```

---

### 📡 交易信号 (`signals`)
从指定频道获取最新的 Alpha 信号或市场指标。

*   **用法**: `methodalgo signals [channel] [options]`
*   **热门频道**:
    *   `etf-tracker`: 监控 BTC/ETH ETF 每日实时资金流入/流出详情。
    *   `market-today`: 每日市场全景总结（包含恐惧贪婪指数、山寨季指数等）。
    *   `golden-pit-mtf`: 低频高质量模式识别信号。
*   **选项**:
    *   `-l, --limit <number>`: 获取信号的数量 (默认: "10")
    *   `--json`: 以 JSON 格式输出原始信号数组。

#### 💡 响应预览
**列表模式**:
```text
[序号] 标题 | 核心内容摘要 (发布时间)
    > 详细数据详情 (如 ETF 净流入额)
    查看原文: [URL]
```
**JSON 模式 (market-today 示例)**:
```json
[
  {
    "id": "1486521752564797454",
    "signals": [
      {
        "title": "Season Index",
        "details": { "Alt Season": "75%", "Bitcoin Season": "Bitcoin outperformed..." },
        "image": "https://cdn.discordapp.com/..."
      }
    ]
  }
]
```

---

### 📰 市场新闻 (`news`)
获取经过 AI 分选的多语言加密货币市场新闻。

*   **用法**: `methodalgo news [options]`
*   **新闻类型**: `breaking` (快讯), `article` (深度), `onchain` (链上), `report` (报告)
*   **选项**:
    *   `-t, --type <type>`: 新闻分类 (默认: "breaking")
    *   `-l, --limit <number>`: 结果数量 (默认: "10")
    *   `-g, --language <lang>`: 输出语言 (zh/en) (默认: "zh")
    *   `-s, --search <keyword>`: 标题关键词搜索。

#### 💡 响应预览
**JSON 模式**:
```json
[
  {
    "type": "news",
    "title": { "zh": "突发：戴维·萨克斯出任...", "en": "JUST IN: David Sacks..." },
    "publish_date": "2026-03-26T22:03:49+00:00",
    "url": "https://..."
  }
]
```

---

## 🖥️ 功能亮点

- ⚡ **极致速度**: 基于 Node SEA 打造，启动毫秒级。
- 🖼️ **终端绘图**: 深度适配 iTerm2，无需离开终端即可看盘。
- 🌍 **多语言**: 原生支持中英双语切换。
- 🤖 **LLM 友好**: 提供结构清晰的 JSON 输出，完美适配 AI Agent 集成。

---

*Powered by Methodalgo.*
