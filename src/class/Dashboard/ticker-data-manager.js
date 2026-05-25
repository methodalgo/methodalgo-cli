import { signedRequest } from "../../utils/api.js";
import { getLang } from "../../utils/i18n.js";
import { fetchBinancePrice } from "../../utils/price-utils.js";

export const TICKER_SOURCE_TYPES = {
    FRED: "fred",
    PRICE: "price",
    NEWS: "news",
    SIGNAL: "signal",
    CUSTOM: "custom"
};

export class TickerDataManager {
    constructor(lang = getLang()) {
        this.lang = lang;
        this.cache = new Map();
        this.fetching = new Set();
    }

    async fetchSource(source, _sourceIndex = 0, dashboardCaches = null) {
        const dashboardData = this._getDashboardCacheData(source, dashboardCaches);
        if (dashboardData) return dashboardData;

        const cacheKey = this._getCacheKey(source);
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 30000) {
            return cached.data;
        }
        if (this.fetching.has(cacheKey)) {
            return cached?.data || null;
        }
        this.fetching.add(cacheKey);
        try {
            const data = await this._fetchByType(source);
            if (data) {
                this.cache.set(cacheKey, { data, timestamp: Date.now() });
            }
            return data;
        } finally {
            this.fetching.delete(cacheKey);
        }
    }

    _getDashboardCacheData(source, dashboardCaches) {
        if (!dashboardCaches || source.type !== TICKER_SOURCE_TYPES.NEWS) return null;
        const panelType = source.typeFilter || "breaking";
        const items = dashboardCaches[panelType];
        if (!Array.isArray(items) || items.length === 0) return null;
        const limit = Math.min(source.limit || 1, 5);
        return items.slice(0, limit).map(item => ({
            title: item.displayTitle || item.title || "",
            url: item.url,
            timestamp: item.timestamp || item.publish_date
        })).filter(item => item.title);
    }

    formatSource(source, data) {
        if (!data) return null;
        const format = source.format || "{value}";
        if (Array.isArray(data)) {
            return data.map(item => this._formatSingle(format, item)).filter(Boolean);
        }
        return this._formatSingle(format, data);
    }

    clearCache() {
        this.cache.clear();
    }

    async _fetchByType(source) {
        switch (source.type) {
            case TICKER_SOURCE_TYPES.FRED:
                return this._fetchFred(source);
            case TICKER_SOURCE_TYPES.PRICE:
                return this._fetchPrice(source);
            case TICKER_SOURCE_TYPES.NEWS:
                return this._fetchNews(source);
            case TICKER_SOURCE_TYPES.SIGNAL:
                return this._fetchSignal(source);
            case TICKER_SOURCE_TYPES.CUSTOM:
                return { text: source.text || "" };
            default:
                return null;
        }
    }

    _getCacheKey(source) {
        switch (source.type) {
            case TICKER_SOURCE_TYPES.FRED:
                return `fred-${source.series || "unknown"}`;
            case TICKER_SOURCE_TYPES.PRICE:
                return `price-${source.symbol || "BTCUSDT"}`;
            case TICKER_SOURCE_TYPES.NEWS:
                return `news-${source.typeFilter || "all"}-${source.limit || 5}`;
            case TICKER_SOURCE_TYPES.SIGNAL:
                return `signal-${source.channel || "default"}`;
            case TICKER_SOURCE_TYPES.CUSTOM:
                return `custom-${(source.text || "").slice(0, 20)}`;
            default:
                return `${source.type}-${JSON.stringify(source)}`;
        }
    }

    async _fetchFred(source) {
        try {
            const response = await signedRequest("/cli/macro", { type: "fred-changes", seriesId: source.series, periods: 2 });
            const rows = response?.data?.data?.data || [];
            const latest = rows[rows.length - 1];
            if (!response?.data?.status || !latest) return { value: "--", series: source.series, direction: null };
            const change = Number(latest.change || 0);
            return {
                value: Number(latest.value).toFixed(2),
                series: source.series,
                direction: change > 0.001 ? "up" : change < -0.001 ? "down" : "flat",
                change,
                date: latest.date
            };
        } catch (e) {
            console.debug(`[TickerBar] Error fetching FRED series ${source.series}:`, e.message);
        }
        return { value: "--", series: source.series, direction: null };
    }

    async _fetchPrice(source) {
        const symbol = source.symbol || "BTCUSDT";
        try {
            const priceData = await fetchBinancePrice(symbol);
            if (priceData) {
                return {
                    value: priceData.price,
                    symbol,
                    change: priceData.change,
                    pctChange: priceData.pctChange,
                    direction: priceData.direction
                };
            }
        } catch (e) {
            console.debug(`[TickerBar] Error fetching price for ${symbol}:`, e.message);
        }
        return {
            value: "--",
            symbol,
            change: 0,
            pctChange: 0,
            direction: null
        };
    }

    async _fetchNews(source) {
        try {
            const typeFilter = source.typeFilter || "breaking";
            const limit = source.limit || 1;
            const result = await signedRequest("/cli/news", {
                type: typeFilter,
                limit: Math.min(limit, 5),
                lang: this.lang
            });
            if (result.data?.status && result.data.data?.length > 0) {
                return result.data.data.slice(0, limit).map(item => ({
                    title: typeof item.title === "object"
                        ? (item.title[this.lang] || item.title.en || "")
                        : (item.title || ""),
                    url: item.url,
                    timestamp: item.timestamp
                }));
            }
        } catch (e) {
            console.debug("[TickerBar] Error fetching news:", e.message);
        }
        return [];
    }

    async _fetchSignal(source) {
        return { channel: source.channel, count: 0, latest: null };
    }

    _formatSingle(format, data) {
        if (!data) return null;
        let result = format;
        const placeholders = {
            value: data.value ?? data.text,
            text: data.text,
            date: data.date,
            title: data.title,
            symbol: data.symbol,
            change: data.change,
            pctChange: data.pctChange,
            channel: data.channel,
            count: data.count
        };
        for (const [key, val] of Object.entries(placeholders)) {
            if (val !== undefined && val !== null) {
                result = result.replace(`{${key}}`, String(val));
            }
        }
        const direction = data.change !== undefined
            ? data.change > 0 ? "up" : data.change < 0 ? "down" : "flat"
            : data.direction || null;
        return { text: result, direction, raw: data };
    }
}
