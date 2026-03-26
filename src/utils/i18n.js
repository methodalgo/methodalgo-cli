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
        ERR_MISSING_KEY: "Missing API Key. Please run 'methodalgo config set api-key <your-key>'",
        ERR_NETWORK: "Network error",
        SUGGESTION_KEY: "Please check your network connection or API Key configuration.",
        SET_SUCCESS: "Set {key} to {value}",
        VAL_NOT_SET: "Configuration {key} is not set",
        FETCH_SUCCESS: "Fetched {count} items:",
        SNAPSHOT_SUCCESS: "Snapshot fetched successfully [{ticker} {tf}]:",
        INVALID_CMD: "Invalid command: {cmd}\nUse 'methodalgo --help' for available commands.",
        LABEL_SUGGESTION: "Suggestion: "
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
        ERR_MISSING_KEY: "缺失 API Key。请运行 'methodalgo config set api-key <your-key>'",
        ERR_NETWORK: "网络错误",
        SUGGESTION_KEY: "请检查您的网络连接或 API Key 是否正确配置。",
        SET_SUCCESS: "已设置 {key} 为 {value}",
        VAL_NOT_SET: "配置项 {key} 未设置",
        FETCH_SUCCESS: "获取到 {count} 条结果:",
        SNAPSHOT_SUCCESS: "快照获取成功 [{ticker} {tf}]:",
        INVALID_CMD: "无效的命令: {cmd}\n使用 'methodalgo --help' 查看可用命令。",
        LABEL_SUGGESTION: "建议方案: "
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
