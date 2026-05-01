import {
    transformNews,
    transformBreakout,
    transformExhaustion,
    transformGoldenPit,
    transformLiquidation,
    transformMarketToday,
    transformTokenUnlock,
    transformFredData,
    transformPriceData,
    transformCalendarData
} from "./panel-transforms.js";

export const PANEL_LABEL_KEYS = {
    article: "TYPE_ARTICLE",
    breaking: "TYPE_NEWS",
    onchain: "TYPE_ONCHAIN",
    report: "TYPE_REPORT",
    breakout: "LABEL_BREAKOUT",
    exhaustion: "LABEL_EXHAUSTION",
    goldenPit: "LABEL_GOLDEN_PIT",
    liquidation: "LABEL_LIQUIDATION",
    marketToday: "LABEL_MARKET_TODAY",
    tokenUnlock: "LABEL_TOKEN_UNLOCK",
    fredDashboard: "LABEL_FRED_DASHBOARD",
    priceTicker: "LABEL_PRICE_TICKER",
    economicCalendar: "LABEL_ECONOMIC_CALENDAR"
};

export const PANEL_CATEGORIES = {
    breakout: "breakout",
    exhaustion: "exhaustion",
    goldenPit: "goldenPit",
    liquidation: "liquidation",
    marketToday: "marketToday",
    tokenUnlock: "tokenUnlock"
};

export const PANEL_FETCHERS = {
    article: {
        type: "news",
        endpoint: "/cli/news",
        params: { type: "article", limit: 30 },
        transform: transformNews
    },
    breaking: {
        type: "news",
        endpoint: "/cli/news",
        params: { type: "breaking", limit: 30 },
        transform: transformNews
    },
    onchain: {
        type: "news",
        endpoint: "/cli/news",
        params: { type: "onchain", limit: 30 },
        transform: transformNews
    },
    report: {
        type: "news",
        endpoint: "/cli/news",
        params: { type: "report", limit: 30 },
        transform: transformNews
    },
    breakout: {
        type: "signals",
        channels: ["breakout-htf", "breakout-mtf"],
        transform: transformBreakout
    },
    exhaustion: {
        type: "signals",
        channels: ["exhaustion-buyer", "exhaustion-seller"],
        transform: transformExhaustion
    },
    goldenPit: {
        type: "signals",
        channels: ["golden-pit-ltf", "golden-pit-mtf"],
        transform: transformGoldenPit
    },
    liquidation: {
        type: "signals",
        channels: ["liquidation"],
        transform: transformLiquidation
    },
    marketToday: {
        type: "single-signal",
        channel: "market-today",
        transform: transformMarketToday
    },
    tokenUnlock: {
        type: "single-signal",
        channel: "token-unlock",
        transform: transformTokenUnlock
    },
    fredDashboard: {
        type: "fred",
        transform: transformFredData
    },
    priceTicker: {
        type: "price",
        symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
        transform: transformPriceData
    },
    economicCalendar: {
        type: "calendar",
        countries: ["US", "EU", "JP"],
        transform: transformCalendarData
    }
};
