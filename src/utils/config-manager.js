import Conf from "conf";

const DEFAULT_DASHBOARD_PANELS = {
    article: { enabled: true, column: 1, order: 1, refreshInterval: 60000, maxVisible: null },
    breaking: { enabled: true, column: 1, order: 2, refreshInterval: 10000, maxVisible: null },
    onchain: { enabled: true, column: 1, order: 3, refreshInterval: 30000, maxVisible: null },
    report: { enabled: true, column: 1, order: 4, refreshInterval: 300000, maxVisible: null },
    breakout: { enabled: true, column: 2, order: 1, refreshInterval: 10000, maxVisible: null },
    exhaustion: { enabled: true, column: 2, order: 2, refreshInterval: 10000, maxVisible: null },
    goldenPit: { enabled: true, column: 2, order: 3, refreshInterval: 10000, maxVisible: null },
    liquidation: { enabled: true, column: 2, order: 4, refreshInterval: 10000, maxVisible: null },
    clock: { enabled: true, column: 3, order: 1, refreshInterval: 1000, maxVisible: null },
    marketToday: { enabled: true, column: 3, order: 2, refreshInterval: 30000, maxVisible: null },
    tokenUnlock: { enabled: true, column: 3, order: 3, refreshInterval: 60000, maxVisible: null },
    fredDashboard: { enabled: false, column: 3, order: 4, refreshInterval: 3600000, maxVisible: null },
    priceTicker: { enabled: false, column: 3, order: 5, refreshInterval: 60000, maxVisible: null },
    binanceSpotMovers24h: { enabled: false, column: 3, order: 6, refreshInterval: 60000, maxVisible: null },
    binanceFuturesMovers24h: { enabled: false, column: 3, order: 7, refreshInterval: 60000, maxVisible: null },
    economicCalendar: { enabled: false, column: 3, order: 8, refreshInterval: 3600000, maxVisible: null }
};

const DEFAULT_DASHBOARD_TICKER = {
    enabled: true,
    speed: 80,
    direction: "left",
    sources: [
        { type: "fred", series: "FEDFUNDS", format: "FEDFUNDS: {value}%", enabled: true },
        { type: "fred", series: "DGS10", format: "10Y: {value}%", enabled: true },
        { type: "price", symbol: "BTCUSDT", format: "BTC: ${value}", enabled: true },
        { type: "price", symbol: "ETHUSDT", format: "ETH: ${value}", enabled: true },
        { type: "news", typeFilter: "breaking", limit: 3, format: "📰 {title}", enabled: true }
    ],
    separator: " | "
};

const DEFAULT_DASHBOARD_THEME = {
    name: "dark-red",
    accentColor: "red",
    secondaryColor: "cyan",
    panelBorder: true,
    compactMode: false
};

const DEFAULT_DASHBOARD_KEYBINDINGS = {
    quit: "q",
    settings: "s",
    refresh: "r",
    search: "f",
    togglePanel: "space",
    nextPanel: "tab",
    prevPanel: "shift+tab",
    toggleTicker: "t",
    help: "?"
};

const DEFAULT_DASHBOARD = {
    layout: "three-column",
    refreshInterval: 60000,
    panels: { ...DEFAULT_DASHBOARD_PANELS },
    ticker: { ...DEFAULT_DASHBOARD_TICKER },
    theme: { ...DEFAULT_DASHBOARD_THEME },
    keybindings: { ...DEFAULT_DASHBOARD_KEYBINDINGS },
    watchlist: {
        symbols: []
    },
    cache: {
        enabled: true,
        ttl: 3600000
    }
};

const schema = {
    apiKey: {
        type: "string",
        default: ""
    },
    apiBase: {
        type: "string",
        default: "https://mm.methodalgo.com"
    },
    accountBase: {
        type: "string",
        default: "https://account.methodalgo.com"
    },
    lang: {
        type: "string",
        default: "en"
    },
    dashboard: {
        type: "object",
        default: DEFAULT_DASHBOARD
    }
};

const config = new Conf({
    projectName: "methodalgo",
    schema
});

export function getDashboardConfig() {
    const stored = config.get("dashboard");
    return normalizeDashboardConfig(mergeDeep(DEFAULT_DASHBOARD, stored || {}));
}

export function setDashboardConfig(partial) {
    const current = getDashboardConfig();
    const updated = mergeDeep(current, partial);
    config.set("dashboard", updated);
    return updated;
}

export function resetDashboardConfig() {
    config.set("dashboard", DEFAULT_DASHBOARD);
    return DEFAULT_DASHBOARD;
}

export function getPanelConfig(panelType) {
    const dashboard = getDashboardConfig();
    return dashboard.panels[panelType] || null;
}

export function setPanelConfig(panelType, partial) {
    const dashboard = getDashboardConfig();
    const current = dashboard.panels[panelType] || {};
    dashboard.panels[panelType] = { ...current, ...partial };
    config.set("dashboard", dashboard);
    return dashboard.panels[panelType];
}

export function getTickerConfig() {
    const dashboard = getDashboardConfig();
    return dashboard.ticker;
}

export function setTickerConfig(partial) {
    const dashboard = getDashboardConfig();
    dashboard.ticker = mergeDeep(dashboard.ticker, partial);
    config.set("dashboard", dashboard);
    return dashboard.ticker;
}

export function getThemeConfig() {
    const dashboard = getDashboardConfig();
    return dashboard.theme;
}

export function setThemeConfig(partial) {
    const dashboard = getDashboardConfig();
    dashboard.theme = mergeDeep(dashboard.theme, partial);
    config.set("dashboard", dashboard);
    return dashboard.theme;
}

export function getKeybindings() {
    const dashboard = getDashboardConfig();
    return dashboard.keybindings;
}

export function getEnabledPanels() {
    const dashboard = getDashboardConfig();
    return Object.entries(dashboard.panels)
        .filter(([, cfg]) => cfg.enabled)
        .map(([type]) => type);
}

export function getPanelsByColumn() {
    const dashboard = getDashboardConfig();
    const columns = { 1: [], 2: [], 3: [] };
    
    for (const [type, cfg] of Object.entries(dashboard.panels)) {
        if (cfg.enabled) {
            const col = cfg.column || 1;
            columns[col].push({ type, config: cfg });
        }
    }
    
    for (const col in columns) {
        columns[col].sort((a, b) => (a.config.order || 0) - (b.config.order || 0));
    }
    
    return columns;
}

function mergeDeep(target, source) {
    if (source === null || source === undefined) {
        return target;
    }
    
    if (target === null || target === undefined) {
        return source;
    }
    
    if (typeof target !== "object" || typeof source !== "object") {
        return source;
    }
    
    if (Array.isArray(target) && Array.isArray(source)) {
        return [...source];
    }
    
    const output = { ...target };
    
    for (const key in source) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) {
            continue;
        }
        
        if (source[key] === null) {
            output[key] = null;
        } else if (typeof source[key] === "object" && !Array.isArray(source[key])) {
            output[key] = mergeDeep(target[key], source[key]);
        } else {
            output[key] = source[key];
        }
    }
    
    return output;
}

function normalizeDashboardConfig(dashboard) {
    const panels = { ...(dashboard.panels || {}) };
    delete panels.binanceMovers24h;
    delete panels.binanceMoversUtc;
    return { ...dashboard, panels };
}

export {
    DEFAULT_DASHBOARD,
    DEFAULT_DASHBOARD_PANELS,
    DEFAULT_DASHBOARD_TICKER,
    DEFAULT_DASHBOARD_THEME,
    DEFAULT_DASHBOARD_KEYBINDINGS
};

export default config;
