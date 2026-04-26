import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text } from "ink";
import { signedRequest } from "../../utils/api.js";
import { getLang } from "../../utils/i18n.js";
import { getTickerConfig } from "../../utils/config-manager.js";
import * as fred from "../../utils/fred-api.js";
import { fetchBinancePrice, formatPrice } from "../../utils/price-utils.js";

const h = React.createElement;

const TICKER_SOURCE_TYPES = {
    FRED: "fred",
    PRICE: "price",
    NEWS: "news",
    SIGNAL: "signal",
    CUSTOM: "custom"
};

class TickerDataManager {
    constructor(lang) {
        this.lang = lang;
        this.cache = new Map();
        this.fetching = new Set();
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

    async fetchSource(source, index) {
        const cacheKey = this._getCacheKey(source);
        const cached = this.cache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp < 30000)) {
            return cached.data;
        }

        if (this.fetching.has(cacheKey)) {
            return cached?.data || null;
        }

        this.fetching.add(cacheKey);

        try {
            let data;
            switch (source.type) {
                case TICKER_SOURCE_TYPES.FRED:
                    data = await this._fetchFred(source);
                    break;
                case TICKER_SOURCE_TYPES.PRICE:
                    data = await this._fetchPrice(source);
                    break;
                case TICKER_SOURCE_TYPES.NEWS:
                    data = await this._fetchNews(source);
                    break;
                case TICKER_SOURCE_TYPES.SIGNAL:
                    data = await this._fetchSignal(source);
                    break;
                case TICKER_SOURCE_TYPES.CUSTOM:
                    data = { text: source.text || "" };
                    break;
                default:
                    data = null;
            }

            if (data) {
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
            }

            return data;
        } finally {
            this.fetching.delete(cacheKey);
        }
    }

    async _fetchFred(source) {
        const apiKey = fred.getFredApiKey();
        if (!apiKey) {
            return { value: "--", series: source.series, direction: null };
        }

        try {
            const obsRes = await fred.getSeriesObservations({
                series_id: source.series,
                sort_order: "desc",
                limit: 10
            });

            const obs = obsRes.observations?.filter(o => o.value !== ".") || [];

            if (obs.length > 0) {
                const latest = obs[0];
                const prev = obs.length > 1 ? obs[1] : null;
                const value = Number(latest.value);
                const change = prev ? value - Number(prev.value) : 0;
                const direction = change > 0.001 ? "up" : change < -0.001 ? "down" : "flat";

                return {
                    value: value.toFixed(2),
                    series: source.series,
                    direction,
                    change,
                    date: latest.date
                };
            }
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
                const items = result.data.data.slice(0, limit);
                return items.map(item => {
                    const title = typeof item.title === "object"
                        ? (item.title[this.lang] || item.title.en || "")
                        : (item.title || "");
                    return { title, url: item.url, timestamp: item.timestamp };
                });
            }
        } catch (e) {
            console.debug(`[TickerBar] Error fetching news:`, e.message);
        }
        return [];
    }

    async _fetchSignal(source) {
        // TODO: Implement signal ticker source - fetch latest signals for display
        return { channel: source.channel, count: 0, latest: null };
    }

    formatSource(source, data) {
        if (!data) return null;

        const format = source.format || "{value}";
        let result = format;

        if (Array.isArray(data)) {
            return data.map(item => this._formatSingle(format, item)).filter(Boolean);
        }

        return this._formatSingle(format, data);
    }

    _formatSingle(format, data) {
        if (!data) return null;

        let result = format;
        const placeholders = {
            value: data.value,
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

        let direction = null;
        if (data.change !== undefined) {
            direction = data.change > 0 ? "up" : data.change < 0 ? "down" : "flat";
        } else if (data.direction) {
            direction = data.direction;
        }

        return { text: result, direction, raw: data };
    }

    clearCache() {
        this.cache.clear();
    }
}

export const TickerBar = ({ enabled = true, config = null, onToggle = null }) => {
    const termCols = process.stdout.columns || 120;
    const placeholder = " Loading market data... ".padEnd(termCols, " ");
    
    const [tickerText, setTickerText] = useState(placeholder);
    const [offset, setOffset] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [sourceData, setSourceData] = useState([]);
    
    const tickerDataManager = useRef(null);
    const actualConfig = config || getTickerConfig();

    useEffect(() => {
        tickerDataManager.current = new TickerDataManager(getLang());
    }, []);

    const fetchAllSources = useCallback(async () => {
        if (!tickerDataManager.current || !actualConfig?.sources) return;

        const enabledSources = actualConfig.sources.filter(s => s.enabled !== false);
        
        const results = await Promise.allSettled(
            enabledSources.map(async (source, i) => {
                try {
                    const data = await tickerDataManager.current.fetchSource(source, i);
                    const formatted = tickerDataManager.current.formatSource(source, data);
                    return formatted;
                } catch (e) {
                    console.debug(`[TickerBar] Error fetching source ${source.type}:`, e.message);
                    return null;
                }
            })
        );

        const allFormatted = [];
        for (const result of results) {
            if (result.status === "fulfilled" && result.value) {
                if (Array.isArray(result.value)) {
                    allFormatted.push(...result.value);
                } else {
                    allFormatted.push(result.value);
                }
            }
        }

        setSourceData(allFormatted);

        const separator = actualConfig.separator || " | ";
        const textParts = allFormatted.map(f => f?.text || "").filter(Boolean);
        const fullText = textParts.join(separator);
        
        if (fullText.trim()) {
            setOffset(0);
            setTickerText(fullText + separator + fullText);
        }
    }, [actualConfig]);

    useEffect(() => {
        if (enabled) {
            fetchAllSources();
            
            const refreshInterval = setInterval(() => {
                fetchAllSources();
            }, 30000);

            return () => clearInterval(refreshInterval);
        }
    }, [enabled, fetchAllSources]);

    useEffect(() => {
        if (!enabled || !tickerText || isPaused) return;

        const speed = actualConfig?.speed || 80;
        const delay = Math.max(30, Math.round(1000 / (speed / 10)));

        const timer = setInterval(() => {
            setOffset(prev => {
                const textLength = tickerText.length / 2;
                if (textLength <= 0) return 0;
                return (prev + 1) % textLength;
            });
        }, delay);

        return () => clearInterval(timer);
    }, [enabled, tickerText, isPaused, actualConfig]);

    const getDirectionColor = (direction) => {
        switch (direction) {
            case "up":
            case "bull":
                return "green";
            case "down":
            case "bear":
                return "red";
            default:
                return "white";
        }
    };

    if (!enabled) return null;

    const displayText = tickerText.slice(offset);
    const paddedText = displayText.padEnd(termCols + 20, " ");
    const visibleText = paddedText.slice(0, termCols + 20).replace(/[\r\n]/g, " ");

    return h(Box, {
        flexDirection: "row",
        borderStyle: "single",
        borderColor: "red",
        height: 3,
        paddingX: 0,
        alignItems: "center",
        overflow: "hidden",
        width: "100%"
    },
        h(Box, { flexGrow: 1, overflow: "hidden", paddingX: 1 },
            h(Text, { color: "white", wrap: "truncate" }, visibleText)
        ),
        onToggle && h(Text, { color: "gray", paddingX: 1 }, " [T]")
    );
};

export { TickerDataManager, TICKER_SOURCE_TYPES };
