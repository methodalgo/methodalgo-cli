import config from "./config-manager.js";

const translations = {
    en: {
        HELP_DESC: "Methodalgo Market Intelligence Tool (Optimized for LLMs)",
        CONFIG_DESC: "Manage tool configuration (e.g., API Key)",
        CONFIG_SET_DESC: "Set configuration item",
        CONFIG_GET_DESC: "Get configuration item",
        CONFIG_LIST_DESC: "List all configurations (excluding sensitive info)",
        SNAPSHOT_DESC: "Get TradingView chart snapshot",
        NEWS_DESC: "Get cryptocurrency market news",
        SIGNALS_DESC: "Get trading signals",
        DASHBOARD_DESC: "Open real-time TUI dashboard (3-column layout)",
        COL_NEWS: "Market News",
        COL_SIGNALS: "L2 Signals",
        COL_STATUS: "System Status",
        TYPE_ARTICLE: "Articles",
        TYPE_NEWS: "Breaking",
        TYPE_ONCHAIN: "On-Chain",
        TYPE_REPORT: "Reports",
        TUI_QUIT: "Press 'q' or 'Ctrl+C' to quit",
        ERR_MISSING_KEY: "Missing API Key. Please run 'methodalgo config set api-key <your-key>'",
        ERR_NETWORK: "Network error",
        SUGGESTION_KEY: "Please check your network connection or API Key configuration.",
        SET_SUCCESS: "Set {key} to {value}",
        VAL_NOT_SET: "Configuration {key} is not set",
        FETCH_SUCCESS: "Fetched {count} items:",
        SNAPSHOT_SUCCESS: "Snapshot fetched successfully [{ticker} {tf}]:",
        INVALID_CMD: "Invalid command: {cmd}\nUse 'methodalgo --help' for available commands.",
        LABEL_SUGGESTION: "Suggestion: ",
        LABEL_EXAMPLE: "Example: ",
        SIGNALS_CHANNELS: `Supported Channels:
- breakout-htf: Detects 1D/3D trends. Alerts on price breaking 100-candle high/low.
- breakout-mtf: Detects 1H/4H trends. Alerts on price breaking 100-candle high/low.
- breakout-24h: Continuous rolling detection based on past 24h high/low.
- liquidation: Large liquidation order alerts.
- exhaustion-seller/buyer: concentrated inventory reversal signals (<10%).
- golden-pit-ltf/mtf: Power Ranger 'Smart Cloud' patterns (Pump/Dump).
- token-unlock: Token unlock event highlights with countdowns.
- etf-tracker: Daily inflows/outflows for BTC/ETH and SOL/XRP.
- market-today: Alt Season Index and Fear & Greed Index.`,
        NEWS_TYPES: `Supported Types:
- article: Market news & analysis.
- breaking: Real-time breaking news.
- onchain: On-chain abnormality detection.
- report: Institutional research reports.`,
        ERR_AUTH_FAILED: "API Key Invalid or Expired.",
        GET_API_KEY_LINK: "Get a new key at: https://account.methodalgo.com/account/api-keys",
        RECONFIG_TIP: "Use 'methodalgo config set api-key <key>' to update.",
        ONBOARD_WELCOME: "Welcome to MethodAlgo! It seems you haven't set an API Key yet.",
        ONBOARD_PROMPT: "Please enter your API Key: ",
        ONBOARD_VALIDATING: "Validating API Key... (Testing with a small request)",
        ONBOARD_SUCCESS: "API Key verified and saved successfully!",
        ONBOARD_FAILED: "Invalid API Key. Please double check and try again.",
        ONBOARD_GET_LINK: "Get your key here: https://account.methodalgo.com/account/api-keys",
        ONBOARD_LANG_PROMPT: "Select Language (1: English, 2: 中文): ",
        LOGOUT_DESC: "Logout and clear API Key",
        LOGOUT_SUCCESS: "Successfully logged out. API Key cleared, language preference kept.",
        ERR_INVALID_CONFIG_KEY: "Invalid configuration key: {key}",
        VAL_ALLOWED_KEYS: "Allowed keys are: api-key, lang, api-base",
        ARG_SYMBOL_DESC: "Symbol (e.g., SOLUSDT for Spot, SOLUSDT.P for Perpetual)",
        ARG_TF_DESC: "Timeframe (default 60)",
        OPT_URL_DESC: "Force return the URL instead of binary (recommended for LLMs)",
        OPT_BUFFER_DESC: "Force return binary buffer and try to render in terminal",
        OPT_SEARCH_DESC: "Search keywords in news titles",
        OPT_START_DATE_DESC: "Filter news from this date (e.g., 2026-03-20)",
        OPT_END_DATE_DESC: "Filter news up to this date",
        SNAPSHOT_EXAMPLE: "methodalgo snapshot BTCUSDT 30",
        NEWS_EXAMPLE: "methodalgo news --type breaking --limit 5 --search 'Bitcoin'",
        SIGNALS_EXAMPLE: "methodalgo signals breakout-mtf",
        CONFIG_EXAMPLE: "methodalgo config set lang zh",
        DASHBOARD_EXAMPLE: "methodalgo dashboard",
        TUI_HINTS: "Q:Quit | Tab:Switch | Enter:Detail"
    },
    zh: {
        HELP_DESC: "Methodalgo 市场情报工具 (针对大模型优化版)",
        CONFIG_DESC: "管理工具配置 (如 API Key)",
        CONFIG_SET_DESC: "设置配置项",
        CONFIG_GET_DESC: "获取配置项",
        CONFIG_LIST_DESC: "列出所有配置 (不包含敏感信息)",
        SNAPSHOT_DESC: "获取 TradingView 图表快照",
        NEWS_DESC: "获取加密货币市场新闻",
        SIGNALS_DESC: "获取交易信号",
        DASHBOARD_DESC: "打开实时 TUI 仪表盘 (三列布局)",
        COL_NEWS: "市场新闻",
        COL_SIGNALS: "L2 信号",
        COL_STATUS: "系统状态",
        TYPE_ARTICLE: "深度文章",
        TYPE_NEWS: "实时快讯",
        TYPE_ONCHAIN: "链上监测",
        TYPE_REPORT: "机构报告",
        TUI_QUIT: "按 'q' 或 'Ctrl+C' 退出",
        ERR_MISSING_KEY: "缺失 API Key。请运行 'methodalgo config set api-key <your-key>'",
        ERR_NETWORK: "网络错误",
        SUGGESTION_KEY: "请检查您的网络连接或 API Key 是否正确配置。",
        SET_SUCCESS: "已设置 {key} 为 {value}",
        VAL_NOT_SET: "配置项 {key} 未设置",
        FETCH_SUCCESS: "获取到 {count} 条结果:",
        SNAPSHOT_SUCCESS: "快照获取成功 [{ticker} {tf}]:",
        INVALID_CMD: "无效的命令: {cmd}\n使用 'methodalgo --help' 查看可用命令。",
        LABEL_SUGGESTION: "建议方案: ",
        LABEL_EXAMPLE: "示例: ",
        SIGNALS_CHANNELS: `支持的频道：
- breakout-htf: 检测1D/3D趋势。在当前K线突破前100根K线高低点时报警。
- breakout-mtf: 检测1H/4H趋势。在当前K线突破前100根K线高低点时报警。
- breakout-24h: 基于过去24小时高低点的持续滚动检测。
- liquidation: 大额强平订单实时提醒。
- exhaustion-seller/buyer: 基于30分钟强平库存集中度(<10%)的逆转信号。
- golden-pit-ltf/mtf: 'Smart Cloud' 模式，预示随后会有显著的程序化波动。
- token-unlock: 代币解锁事件高亮及倒计时计。
- etf-tracker: BTC/ETH 和 SOL/XRP 每日资金流入/流出追踪。
- market-today: 每日山寨季指数与贪婪恐惧指数。输出。`,
        NEWS_TYPES: `支持的类型：
- article: 深度市场新闻与分析。
- breaking: 实时快讯。
- onchain: 链上数据异动监测。
- report: 机构研究报告。`,
        ERR_AUTH_FAILED: "API Key 无效或已过期。",
        GET_API_KEY_LINK: "请在此获取新 Key: https://account.methodalgo.com/zh/account/api-keys",
        RECONFIG_TIP: "请运行 'methodalgo config set api-key <key>' 进行更新。",
        ONBOARD_WELCOME: "欢迎使用 MethodAlgo！检测到您尚未配置 API Key。",
        ONBOARD_PROMPT: "请输入您的 API Key: ",
        ONBOARD_VALIDATING: "正在验证 API Key... (尝试拉取测试数据)",
        ONBOARD_SUCCESS: "API Key 验证通过并已成功保存！",
        ONBOARD_FAILED: "API Key 无效，请检查后重试。",
        ONBOARD_GET_LINK: "获取链接: https://account.methodalgo.com/zh/account/api-keys",
        ONBOARD_LANG_PROMPT: "请选择语言 / Select Language (1: English, 2: 中文): ",
        LOGOUT_DESC: "退出登录并清除 API Key",
        LOGOUT_SUCCESS: "成功退出登录。API Key 已清除，语言设置已保留。",
        ERR_INVALID_CONFIG_KEY: "无效的配置键: {key}",
        VAL_ALLOWED_KEYS: "允许的键包括: api-key, lang, api-base",
        ARG_SYMBOL_DESC: "交易对符号 (例如: SOLUSDT 为现货, SOLUSDT.P 为合约)",
        ARG_TF_DESC: "时间周期 (默认 60)",
        OPT_URL_DESC: "强制返回 URL 链接而非二进制流 (大模型调用时建议开启)",
        OPT_BUFFER_DESC: "强制返回二进制流并尝试在终端渲染",
        OPT_SEARCH_DESC: "在新闻标题中搜索关键词",
        OPT_START_DATE_DESC: "从此日期开始筛选 (如: 2026-03-20)",
        OPT_END_DATE_DESC: "在此日期前筛选",
        SNAPSHOT_EXAMPLE: "methodalgo snapshot BTCUSDT 30",
        NEWS_EXAMPLE: "methodalgo news --type breaking --limit 5 --search '比特币'",
        SIGNALS_EXAMPLE: "methodalgo signals breakout-mtf",
        CONFIG_EXAMPLE: "methodalgo config set lang zh",
        DASHBOARD_EXAMPLE: "methodalgo dashboard",
        TUI_HINTS: "Q:退出 | Tab:切换 | Enter:详情"
    }
};

export function getLang() {
    return config.get("lang") || "en";
}

/**
 * 翻译函数
 * @param {string} key 键值
 * @param {object} params 替换参数
 */
export function t(key, params = {}) {
    const lang = config.get("lang") || "en";
    let text = translations[lang][key] || translations["en"][key] || key;
    
    // 简单的占位符替换
    Object.keys(params).forEach(p => {
        text = text.replace(`{${p}}`, params[p]);
    });
    
    return text;
}
