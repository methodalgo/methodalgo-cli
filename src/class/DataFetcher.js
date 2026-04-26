import { signedRequest } from "../utils/api.js";
import { cleanText } from "../utils/dashboard-utils.js";
import { getLang, t } from "../utils/i18n.js";
import config from "../utils/config-manager.js";
import * as fred from "../utils/fred-api.js";
import { fetchBinancePrice, formatPrice } from "../utils/price-utils.js";

const PANEL_FETCHERS = {
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

function transformNews(data, lang) {
    if (!data?.status) return [];
    return (data.data || [])
        .filter(item => item && (item.title || item.displayTitle))
        .map(item => ({
            ...item,
            displayTitle: typeof item.title === "object" 
                ? (item.title[lang] || item.title.en || "") 
                : (item.title || ""),
            timestamp: item.ts || item.timestamp || item.updatedAt || item.publish_date || new Date().toISOString()
        }))
        .filter(item => item.displayTitle?.trim().length > 0);
}

function transformBreakout(items, lang) {
    return items.map(item => {
        const sig = item.signals?.[0] || {};
        const details = sig.details || {};
        const tf = extractTimeFrame(sig, details);
        const tfStr = tf ? `[${tf}] ` : "";
        
        let symbol = cleanText(details.Symbol || details.symbol || "");
        if (!symbol) {
            const match = (sig.title || "").match(/For\s+([\w.*-]+)/i);
            if (match) symbol = match[1];
        }
        
        const side = (details.Side || details.side || "").toLowerCase();
        const type = (details.Type || details.type || "").toLowerCase();
        const direction = item.direction || sig.direction || "";
        
        const isDown = side.includes("down") || direction === "bear" || type.includes("down");
        const isUp = side.includes("up") || direction === "bull" || type.includes("up");
        const dirStr = isUp ? "UP" : isDown ? "DOWN" : "";
        
        const finalDirection = isDown ? "bear" : isUp ? "bull" : direction;
        const baseTitle = sig.title || item.displayTitle || item.title || "";
        const cleanTitle = cleanText(typeof baseTitle === "object" ? (baseTitle[lang] || baseTitle.en) : baseTitle);
        
        let finalTitle = cleanTitle;
        if (symbol) finalTitle = `${tfStr}Breakout ${dirStr} For ${symbol}`;
        
        return {
            ...item,
            direction: finalDirection,
            displayTitle: finalTitle.replace(/\s+/g, " ").trim(),
            timestamp: item.ts || item.timestamp || item.updatedAt || item.publish_date || new Date().toISOString()
        };
    }).filter(item => item.displayTitle?.length > 0);
}

function transformExhaustion(items, lang) {
    return items.map(item => {
        const sig = item.signals?.[0] || {};
        const details = sig.details || {};
        const tf = extractTimeFrame(sig, details);
        const tfStr = tf ? `[${tf}] ` : "";
        
        let symbol = cleanText(details.Symbol || details.symbol || "");
        if (!symbol) {
            const match = (sig.title || "").match(/For\s+([\w.*-]+)/i);
            if (match) symbol = match[1];
        }
        
        const baseTitle = sig.title || item.displayTitle || item.title || "";
        const cleanTitle = cleanText(typeof baseTitle === "object" ? (baseTitle[lang] || baseTitle.en) : baseTitle);
        
        let direction = item.direction || sig.direction || "";
        const lowerTitle = cleanTitle.toLowerCase();
        if (lowerTitle.includes("seller")) direction = "bull";
        if (lowerTitle.includes("buyer")) direction = "bear";
        
        const pureTitle = cleanTitle.replace(/for\s+[\w.*-]+/i, "").trim();
        const finalTitle = symbol ? `${tfStr}${pureTitle} For ${symbol}` : `${tfStr}${pureTitle}`;
        
        return {
            ...item,
            direction,
            displayTitle: finalTitle.replace(/\s+/g, " ").trim(),
            timestamp: item.ts || item.timestamp || item.updatedAt || item.publish_date || new Date().toISOString()
        };
    }).filter(item => item.displayTitle?.length > 0);
}

function transformGoldenPit(items, lang) {
    return items.map(item => {
        const sig = item.signals?.[0] || {};
        const details = sig.details || {};
        const tf = extractTimeFrame(sig, details);
        const tfStr = tf ? `[${tf}] ` : "";
        
        let symbol = cleanText(details.Symbol || details.symbol || "");
        if (!symbol) {
            const match = (sig.title || "").match(/For\s+([\w.*-]+)/i);
            if (match) symbol = match[1];
        }
        
        const direction = item.direction || sig.direction || "";
        const dirStr = direction === "bull" ? "Bull" : direction === "bear" ? "Bear" : "";
        
        const finalTitle = symbol ? `${tfStr}${dirStr} Golden Pit For ${symbol}` : `${tfStr}${dirStr} Golden Pit`;
        
        return {
            ...item,
            direction,
            displayTitle: finalTitle.replace(/\s+/g, " ").trim(),
            timestamp: item.ts || item.timestamp || item.updatedAt || item.publish_date || new Date().toISOString()
        };
    }).filter(item => item.displayTitle?.length > 0);
}

function transformLiquidation(items, lang) {
    return items.map(item => {
        const sig = item.signals?.[0] || {};
        const details = sig.details || {};
        const tf = extractTimeFrame(sig, details);
        const tfStr = tf ? `[${tf}] ` : "";
        
        let symbol = cleanText(details.Symbol || details.symbol || "");
        if (!symbol) {
            const match = (sig.title || "").match(/For\s+([\w.*-]+)/i);
            if (match) symbol = match[1];
        }
        
        const side = (details.Side || details.side || "").toLowerCase();
        const direction = item.direction || sig.direction || "";
        
        const isLong = side.includes("sell") || direction === "bear";
        const isShort = side.includes("buy") || direction === "bull";
        const sideStr = isLong ? "LONG" : isShort ? "SHORT" : "";
        
        const finalDirection = isLong ? "bear" : isShort ? "bull" : direction;
        
        const finalTitle = symbol ? `${tfStr}${sideStr} Liquidation For ${symbol}` : `${tfStr}${sideStr} Liquidation`;
        
        return {
            ...item,
            direction: finalDirection,
            displayTitle: finalTitle.replace(/\s+/g, " ").trim(),
            timestamp: item.ts || item.timestamp || item.updatedAt || item.publish_date || new Date().toISOString()
        };
    }).filter(item => item.displayTitle?.length > 0);
}

function transformMarketToday(data, lang) {
    const raw = data?.data || (Array.isArray(data) ? data : null);
    if (!raw) return [];
    
    return (Array.isArray(raw) ? raw : [raw]).filter(Boolean).map(item => {
        const sigTitle = item.signals?.[0]?.title || "";
        const baseTitle = item.title || item.displayTitle || sigTitle || item.content || item.description || "";
        const cleanTitle = cleanText(typeof baseTitle === "object" ? (baseTitle[lang] || baseTitle.en) : baseTitle);
        
        return {
            ...item,
            timestamp: item.ts || item.timestamp || item.updatedAt || new Date().toISOString(),
            displayTitle: cleanTitle
        };
    }).filter(item => item.displayTitle?.length > 0);
}

function transformTokenUnlock(data, lang) {
    let d = null;
    if (data?.data?.signals && Array.isArray(data.data.signals)) d = data.data.signals;
    else if (data?.data && Array.isArray(data.data)) d = data.data;
    else if (Array.isArray(data)) d = data;
    
    if (!d) return [];
    
    return d.filter(Boolean).map(item => {
        const sym = cleanText(item.symbol || "");
        const perc = item.perc || "";
        const val = cleanText((item.unlockValue || item.unlockTokenVal || "").split('(')[0]);
        
        const rawTs = item.ts || item.timestamp || data?.updatedAt;
        const finalTs = (typeof rawTs === 'number' && rawTs < 10000000000) ? rawTs * 1000 : rawTs;
        
        return {
            ...item,
            timestamp: finalTs || new Date().toISOString(),
            displayTitle: sym ? `${sym} ${perc}% ${val}` : ""
        };
    }).filter(item => item.displayTitle?.length > 0);
}

function transformFredData(data, lang) {
    if (!data) return [];
    
    if (data.error) {
        return [{
            displayTitle: data.error,
            timestamp: new Date().toISOString()
        }];
    }
    
    const items = [];
    
    if (data.rates) {
        for (const [key, val] of Object.entries(data.rates)) {
            if (val && val.value !== undefined) {
                const arrow = val.change > 0.001 ? " ↑" : val.change < -0.001 ? " ↓" : "";
                const dateStr = val.date ? ` [${val.date}]` : "";
                items.push({
                    displayTitle: `${val.label}: ${val.value.toFixed(2)}${val.unit || ""}${arrow}${dateStr}`,
                    timestamp: val.date || new Date().toISOString()
                });
            }
        }
    }
    
    if (data.market) {
        for (const [key, val] of Object.entries(data.market)) {
            if (val && val.value !== undefined) {
                const arrow = val.change > 0.01 ? " ↑" : val.change < -0.01 ? " ↓" : "";
                const dateStr = val.date ? ` [${val.date}]` : "";
                let valueStr = val.formatted || `${val.value.toFixed(2)}${val.unit || ""}`;
                items.push({
                    displayTitle: `${val.label}: ${valueStr}${arrow}${dateStr}`,
                    timestamp: val.date || new Date().toISOString()
                });
            }
        }
    }
    
    if (data.liquidity) {
        for (const [key, val] of Object.entries(data.liquidity)) {
            if (val && val.value !== undefined) {
                const dateStr = val.date ? ` [${val.date}]` : "";
                items.push({
                    displayTitle: `${val.label}: ${val.formatted || val.value}${dateStr}`,
                    timestamp: val.date || new Date().toISOString()
                });
            }
        }
    }
    
    if (data.other) {
        for (const [key, val] of Object.entries(data.other)) {
            if (val && val.value !== undefined) {
                const arrow = val.change > 0.001 ? " ↑" : val.change < -0.001 ? " ↓" : "";
                const dateStr = val.date ? ` [${val.date}]` : "";
                items.push({
                    displayTitle: `${val.label}: ${val.value.toFixed(2)}${val.unit || ""}${arrow}${dateStr}`,
                    timestamp: val.date || new Date().toISOString()
                });
            }
        }
    }
    
    if (data.inflation) {
        for (const [key, val] of Object.entries(data.inflation)) {
            if (val && val.value !== undefined) {
                items.push({
                    displayTitle: `${val.label}: ${val.value.toFixed(2)}%`,
                    timestamp: val.date || new Date().toISOString()
                });
            }
        }
    }
    
    return items;
}

function transformPriceData(data, lang) {
    return data || [];
}

function transformCalendarData(data, lang) {
    return data || [];
}

function extractTimeFrame(sig, details) {
    let tf = details?.TimeFrame || details?.Timeframe || details?.tf || details?.TF || details?.interval || "";
    if (!tf && sig?.description) {
        const m = sig.description.match(/TimeFrame:\s*(\w+)/i);
        if (m) tf = m[1];
    }
    return tf;
}

export class DataFetcher {
    constructor(options = {}) {
        this.lang = options.lang || getLang();
        this.fetchers = new Map();
        this.timers = new Map();
        this.cache = new Map();
        this.stats = new Map();
        this.abortControllers = new Map();
        
        this._initFetchers();
    }
    
    _initFetchers() {
        for (const [panelType, config] of Object.entries(PANEL_FETCHERS)) {
            this.fetchers.set(panelType, {
                ...config,
                lastFetch: 0,
                lastError: null,
                consecutiveErrors: 0
            });
        }
    }
    
    async fetch(panelType, force = false) {
        const fetcher = this.fetchers.get(panelType);
        if (!fetcher) {
            throw new Error(`Unknown panel type: ${panelType}`);
        }
        
        const panelConfig = config.get(`dashboard.panels.${panelType}`) || {};
        const refreshInterval = panelConfig.refreshInterval || 60000;
        
        const now = Date.now();
        const cached = this.cache.get(panelType);
        
        if (!force && cached && (now - cached.timestamp < refreshInterval)) {
            return {
                data: cached.data,
                fromCache: true,
                timestamp: cached.timestamp
            };
        }
        
        if (this.abortControllers.has(panelType)) {
            this.abortControllers.get(panelType).abort();
        }
        
        const abortController = new AbortController();
        this.abortControllers.set(panelType, abortController);
        
        try {
            let data;
            
            switch (fetcher.type) {
                case "news":
                    data = await this._fetchNews(fetcher, abortController.signal);
                    break;
                case "signals":
                    data = await this._fetchSignals(fetcher, abortController.signal);
                    break;
                case "single-signal":
                    data = await this._fetchSingleSignal(fetcher, abortController.signal);
                    break;
                case "fred":
                    data = await this._fetchFred(fetcher, abortController.signal);
                    break;
                case "price":
                    data = await this._fetchPrice(fetcher, abortController.signal);
                    break;
                case "calendar":
                    data = await this._fetchCalendar(fetcher, abortController.signal);
                    break;
                default:
                    throw new Error(`Unknown fetcher type: ${fetcher.type}`);
            }
            
            const transformed = fetcher.transform ? fetcher.transform(data, this.lang) : data;
            
            this.cache.set(panelType, {
                data: transformed,
                timestamp: now,
                hash: this._computeHash(transformed)
            });
            
            fetcher.lastFetch = now;
            fetcher.lastError = null;
            fetcher.consecutiveErrors = 0;
            
            this._updateStats(panelType, true);
            
            return {
                data: transformed,
                fromCache: false,
                timestamp: now
            };
            
        } catch (error) {
            if (error.name === "AbortError") {
                return null;
            }
            
            fetcher.lastError = error;
            fetcher.consecutiveErrors++;
            this._updateStats(panelType, false, error);
            
            if (cached) {
                return {
                    data: cached.data,
                    fromCache: true,
                    stale: true,
                    timestamp: cached.timestamp,
                    error: error.message
                };
            }
            
            throw error;
        } finally {
            this.abortControllers.delete(panelType);
        }
    }
    
    async _fetchNews(fetcher, signal) {
        const params = { ...fetcher.params, lang: this.lang };
        const result = await signedRequest(fetcher.endpoint, params, { signal });
        return result.data;
    }
    
    async _fetchSignals(fetcher, signal) {
        const promises = fetcher.channels.map(channel => 
            signedRequest("/cli/signals", { 
                channelName: channel, 
                limit: 30, 
                lang: this.lang 
            }, { signal }).catch(e => ({ status: "rejected", error: e }))
        );
        
        const results = await Promise.allSettled(promises);
        const allItems = [];
        
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === "fulfilled" && result.value?.data?.status) {
                const d = result.value.data.data;
                let items = [];
                
                if (Array.isArray(d)) {
                    items = d.filter(item => item && (item.signals || item.displayTitle || item.title))
                        .map(item => ({
                            ...item,
                            timestamp: item.ts || item.timestamp || item.updatedAt || item.publish_date || new Date().toISOString()
                        }));
                } else if (d?.signals && Array.isArray(d.signals)) {
                    const channel = fetcher.channels[i];
                    items = d.signals.map((s, idx) => ({
                        id: `compat-${channel}-${idx}`,
                        timestamp: d.updatedAt || d.timestamp || d.publish_date || new Date().toISOString(),
                        signals: [s]
                    }));
                }
                
                allItems.push(...items);
            }
        }
        
        return allItems;
    }
    
    async _fetchSingleSignal(fetcher, signal) {
        const result = await signedRequest("/cli/signals", { 
            channelName: fetcher.channel, 
            limit: 30, 
            lang: this.lang 
        }, { signal });
        return result?.data;
    }
    
    async _fetchFred(fetcher, signal) {
        const apiKey = fred.getFredApiKey();
        if (!apiKey) {
            return {
                error: t("ERR_FRED_KEY_NOT_CONFIGURED")
            };
        }
        
        const rateSeries = [
            { id: "FEDFUNDS", label: "Fed Funds", unit: "%" },
            { id: "DGS1MO", label: "1M Treasury", unit: "%" },
            { id: "DGS3MO", label: "3M Treasury", unit: "%" },
            { id: "DGS6MO", label: "6M Treasury", unit: "%" },
            { id: "DGS1", label: "1Y Treasury", unit: "%" },
            { id: "DGS2", label: "2Y Treasury", unit: "%" },
            { id: "DGS5", label: "5Y Treasury", unit: "%" },
            { id: "DGS10", label: "10Y Treasury", unit: "%" },
            { id: "DGS20", label: "20Y Treasury", unit: "%" },
            { id: "DGS30", label: "30Y Treasury", unit: "%" },
            { id: "T10Y2Y", label: "10Y-2Y Spread", unit: "%" },
            { id: "T10Y3M", label: "10Y-3M Spread", unit: "%" },
        ];
        
        const marketSeries = [
            { id: "VIXCLS", label: "VIX", unit: "" },
            { id: "DCOILWTICO", label: "WTI Crude", unit: "$" },
            { id: "DCOILBRENTEU", label: "Brent Crude", unit: "$" },
            { id: "GOLDAMGBD228NLBM", label: "Gold Price", unit: "$" },
        ];
        
        const liqSeries = [
            { id: "WALCL", label: "Fed Balance Sheet", unitMultiplier: 1 },
            { id: "RRPONTSYD", label: "Reverse Repo", unitMultiplier: 1 },
            { id: "WTREGEN", label: "TGA", unitMultiplier: 1 },
            { id: "M2SL", label: "M2 Money Supply", unitMultiplier: 1 },
        ];
        
        const otherSeries = [
            { id: "UNRATE", label: "Unemployment", unit: "%" },
            { id: "T5YIE", label: "5Y Breakeven", unit: "%" },
            { id: "T10YIE", label: "10Y Breakeven", unit: "%" },
            { id: "DAAA", label: "AAA Yield", unit: "%" },
            { id: "DBAA", label: "BAA Yield", unit: "%" },
        ];
        
        try {
            const results = { rates: {}, market: {}, liquidity: {}, other: {} };
            
            const fetchSeries = async (s, category) => {
                try {
                    const obsRes = await fred.getSeriesObservations({ 
                        series_id: s.id, 
                        sort_order: "desc", 
                        limit: 10 
                    });
                    
                    const obs = obsRes.observations?.filter(o => o.value !== ".") || [];
                    
                    if (obs.length > 0) {
                        const latest = obs[0];
                        const prev = obs.length > 1 ? obs[1] : null;
                        const value = Number(latest.value);
                        const change = prev ? value - Number(prev.value) : 0;
                        
                        const result = {
                            label: s.label,
                            value: value,
                            unit: s.unit || "",
                            change: change,
                            date: latest.date
                        };
                        
                        if (category === "liquidity") {
                            const valueB = value * (s.unitMultiplier || 1);
                            result.value = valueB;
                            result.formatted = this._formatLiquidity(valueB);
                        }
                        
                        results[category][s.id] = result;
                    }
                } catch (e) {
                    console.debug(`[DataFetcher] Error fetching FRED series ${s.id}:`, e.message);
                }
            };
            
            const allPromises = [
                ...rateSeries.map(s => fetchSeries(s, "rates")),
                ...marketSeries.map(s => fetchSeries(s, "market")),
                ...liqSeries.map(s => fetchSeries(s, "liquidity")),
                ...otherSeries.map(s => fetchSeries(s, "other")),
            ];
            
            await Promise.all(allPromises);
            
            if (results.liquidity.WALCL) {
                const walcl = results.liquidity.WALCL.value || 0;
                const rrp = results.liquidity.RRPONTSYD?.value || 0;
                const tga = results.liquidity.WTREGEN?.value || 0;
                const netLiq = walcl - rrp - tga;
                
                results.liquidity.NET_LIQ = {
                    label: "Net Liquidity",
                    value: netLiq,
                    formatted: this._formatLiquidity(netLiq)
                };
            }
            
            if (results.market.GOLDAMGBD228NLBM) {
                results.market.GOLDAMGBD228NLBM.formatted = `$${results.market.GOLDAMGBD228NLBM.value.toFixed(2)}`;
            }
            
            return results;
            
        } catch (e) {
            return {
                error: t("ERR_FRED_API_ERROR", { message: e.message })
            };
        }
    }
    
    _formatLiquidity(value) {
        if (value === null || value === undefined) return "N/A";
        if (Math.abs(value) >= 1000) {
            return `$${(value / 1000).toFixed(2)}T`;
        }
        return `$${value.toFixed(1)}B`;
    }
    
    async _fetchPrice(fetcher, signal) {
        const symbols = fetcher.symbols || ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
        const results = [];
        
        for (const symbol of symbols) {
            try {
                const priceData = await fetchBinancePrice(symbol, { signal });
                if (priceData) {
                    const displayTitle = priceData.direction 
                        ? `${symbol}: ${priceData.price} (${priceData.pctChange > 0 ? "+" : ""}${priceData.pctChange.toFixed(2)}%)`
                        : `${symbol}: ${priceData.price}`;
                    
                    results.push({
                        ...priceData,
                        displayTitle,
                        timestamp: priceData.timestamp
                    });
                }
            } catch (e) {
                console.debug(`[DataFetcher] Error fetching price for ${symbol}:`, e.message);
            }
        }
        
        return results;
    }
    
    async _fetchCalendar(fetcher, signal) {
        const countries = fetcher.countries || ["US", "EU", "JP"];
        const today = new Date();
        const from = today.toISOString().split("T")[0];
        const to = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        
        try {
            const result = await signedRequest("/cli/calendar", {
                countries: countries.join(","),
                from,
                to
            }, { signal });
            
            const { status, data, message } = result.data;
            if (!status) return [];
            
            return (data || []).map(item => {
                const importanceStr = "⭐".repeat(item.importance);
                const displayTitle = `[${importanceStr}] ${item.country}: ${item.title}`;
                
                return {
                    ...item,
                    importanceStr,
                    displayTitle,
                    timestamp: item.date
                };
            });
        } catch (e) {
            return [];
        }
    }
    
    async fetchMultiple(panelTypes, force = false) {
        const results = {};
        const errors = {};
        
        await Promise.all(panelTypes.map(async (type) => {
            try {
                results[type] = await this.fetch(type, force);
            } catch (e) {
                errors[type] = e;
            }
        }));
        
        return { results, errors };
    }
    
    startAutoRefresh(panelTypes, onUpdate) {
        this.stopAutoRefresh();
        
        const scheduleNext = (panelType, interval) => {
            if (interval <= 0) return;
            
            const timer = setTimeout(async () => {
                try {
                    const result = await this.fetch(panelType, false);
                    if (onUpdate && result && !result.fromCache) {
                        onUpdate(panelType, result);
                    }
                } catch (e) {
                    console.debug(`[DataFetcher] Auto-refresh error for ${panelType}:`, e.message);
                } finally {
                    if (this.timers.get(panelType) === timer) {
                        scheduleNext(panelType, interval);
                    }
                }
            }, interval);
            
            this.timers.set(panelType, timer);
        };
        
        for (const panelType of panelTypes) {
            const panelConfig = config.get(`dashboard.panels.${panelType}`) || {};
            const interval = panelConfig.refreshInterval || 60000;
            
            if (interval > 0) {
                scheduleNext(panelType, interval);
            }
        }
    }
    
    stopAutoRefresh(panelTypes = null) {
        const types = panelTypes || [...this.timers.keys()];
        
        for (const type of types) {
            const timer = this.timers.get(type);
            if (timer) {
                clearInterval(timer);
                this.timers.delete(type);
            }
            
            const abortController = this.abortControllers.get(type);
            if (abortController) {
                abortController.abort();
                this.abortControllers.delete(type);
            }
        }
    }
    
    getCached(panelType) {
        return this.cache.get(panelType);
    }
    
    getStats(panelType) {
        return this.stats.get(panelType);
    }
    
    getAllStats() {
        const stats = {};
        for (const [type, fetcher] of this.fetchers) {
            stats[type] = {
                lastFetch: fetcher.lastFetch,
                lastError: fetcher.lastError?.message,
                consecutiveErrors: fetcher.consecutiveErrors,
                ...this.stats.get(type)
            };
        }
        return stats;
    }
    
    _updateStats(panelType, success, error = null) {
        const existing = this.stats.get(panelType) || {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            lastSuccess: 0,
            lastFailure: 0
        };
        
        existing.totalRequests++;
        
        if (success) {
            existing.successfulRequests++;
            existing.lastSuccess = Date.now();
        } else {
            existing.failedRequests++;
            existing.lastFailure = Date.now();
            existing.lastErrorMessage = error?.message;
        }
        
        this.stats.set(panelType, existing);
    }
    
    _computeHash(data) {
        if (!data) return "";
        
        if (Array.isArray(data)) {
            const len = data.length;
            if (len === 0) return "0";
            
            const firstTs = data[0]?.timestamp || "";
            const lastTs = data[len - 1]?.timestamp || "";
            return `${len}-${firstTs}-${lastTs}`;
        }
        
        try {
            const str = JSON.stringify(data);
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return String(hash);
        } catch {
            return "";
        }
    }
    
    destroy() {
        this.stopAutoRefresh();
        this.cache.clear();
        this.fetchers.clear();
        this.stats.clear();
        this.abortControllers.clear();
    }
}

export { PANEL_FETCHERS };
