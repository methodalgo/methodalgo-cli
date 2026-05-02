import { signedRequest, signedStreamRequest } from "../utils/api.js";
import { getLang, t } from "../utils/i18n.js";
import config from "../utils/config-manager.js";
import * as fred from "../utils/fred-api.js";
import { fetchBinanceMovers, fetchBinancePrice } from "../utils/price-utils.js";
import { PANEL_FETCHERS } from "./Dashboard/panel-registry.js";

const DASHBOARD_SNAPSHOT_PANELS = new Set([
    "article",
    "breaking",
    "onchain",
    "report",
    "breakout",
    "exhaustion",
    "goldenPit",
    "liquidation",
    "marketToday",
    "tokenUnlock"
]);

export class DataFetcher {
    constructor(options = {}) {
        this.lang = options.lang || getLang();
        this.fetchers = new Map();
        this.timers = new Map();
        this.cache = new Map();
        this.stats = new Map();
        this.abortControllers = new Map();
        this.dashboardStreamController = null;
        this.dashboardStreamMaxRetries = options.dashboardStreamMaxRetries ?? 2;
        this.dashboardStreamRetryDelay = options.dashboardStreamRetryDelay ?? 1000;
        
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
                case "binance-movers":
                    data = await this._fetchBinanceMovers(fetcher, abortController.signal);
                    break;
                case "calendar":
                    data = await this._fetchCalendar(fetcher, abortController.signal);
                    break;
                default:
                    throw new Error(`Unknown fetcher type: ${fetcher.type}`);
            }
            
            const transformed = fetcher.transform ? fetcher.transform(data, this.lang) : data;
            return this._storePanelResult(panelType, transformed, now);
            
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

    async _fetchBinanceMovers(fetcher, signal) {
        try {
            const result = await fetchBinanceMovers({
                market: fetcher.market || "spot",
                limit: fetcher.limit || 5,
                minQuoteVolume: fetcher.minQuoteVolume || 1000000,
                signal
            });
            return formatBinanceMoverRows(result);
        } catch (e) {
            return [{
                displayTitle: t("ERR_BINANCE_MOVERS_UNAVAILABLE", { message: e.message }),
                timestamp: new Date().toISOString(),
                direction: "bear"
            }];
        }
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
        const snapshotPanels = panelTypes.filter(type => this._canFetchViaDashboardSnapshot(type));
        const directPanels = panelTypes.filter(type => !this._canFetchViaDashboardSnapshot(type));
        
        if (snapshotPanels.length > 0) {
            try {
                const snapshot = await this._fetchDashboardSnapshot(snapshotPanels, force);
                for (const panelType of snapshotPanels) {
                    const fetcher = this.fetchers.get(panelType);
                    const raw = snapshot.data?.[panelType];
                    if (raw === undefined) {
                        errors[panelType] = new Error(snapshot.errors?.[panelType] || "Missing dashboard snapshot panel");
                        continue;
                    }
                    const transformed = fetcher.transform ? fetcher.transform(raw, this.lang) : raw;
                    results[panelType] = this._storePanelResult(panelType, transformed, Date.now());
                }
                for (const [panelType, message] of Object.entries(snapshot.errors || {})) {
                    if (!results[panelType]) errors[panelType] = new Error(message);
                }
            } catch (e) {
                directPanels.push(...snapshotPanels);
            }
        }
        
        await Promise.all(directPanels.map(async (type) => {
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
        
        const scheduleNext = (timerKey, groupedPanels, interval) => {
            if (interval <= 0) return;
            
            const timer = setTimeout(async () => {
                try {
                    const { results, errors } = await this.fetchMultiple(groupedPanels, false);
                    if (onUpdate) {
                        for (const [panelType, result] of Object.entries(results)) {
                            if (result && (!result.fromCache || result.error)) {
                                onUpdate(panelType, result);
                            }
                        }
                        for (const [panelType, error] of Object.entries(errors)) {
                            onUpdate(panelType, { error: error.message });
                        }
                    }
                } catch (e) {
                    console.debug(`[DataFetcher] Auto-refresh error for ${timerKey}:`, e.message);
                    if (onUpdate) {
                        for (const panelType of groupedPanels) onUpdate(panelType, { error: e.message });
                    }
                } finally {
                    const current = this.timers.get(timerKey);
                    if (current?.timer === timer) {
                        scheduleNext(timerKey, groupedPanels, interval);
                    }
                }
            }, interval);
            
            this.timers.set(timerKey, { timer, panelTypes: groupedPanels });
        };
        
        const groups = new Map();
        for (const panelType of panelTypes) {
            const panelConfig = config.get(`dashboard.panels.${panelType}`) || {};
            const interval = panelConfig.refreshInterval || 60000;
            
            if (interval > 0) {
                const groupedPanels = groups.get(interval) || [];
                groupedPanels.push(panelType);
                groups.set(interval, groupedPanels);
            }
        }
        
        for (const [interval, groupedPanels] of groups.entries()) {
            scheduleNext(`interval:${interval}:${groupedPanels.join(",")}`, groupedPanels, interval);
        }
    }
    
    startDashboardStream(panelTypes, onUpdate, onError = null) {
        const streamPanels = panelTypes.filter(type => this._canFetchViaDashboardSnapshot(type));
        if (streamPanels.length === 0) return false;
        
        this.stopDashboardStream();
        const controller = new AbortController();
        this.dashboardStreamController = controller;
        
        this._runDashboardStream(streamPanels, onUpdate, onError, controller);
        
        return true;
    }
    
    stopDashboardStream() {
        if (this.dashboardStreamController) {
            this.dashboardStreamController.abort();
            this.dashboardStreamController = null;
        }
    }
    
    stopAutoRefresh(panelTypes = null) {
        if (!panelTypes) this.stopDashboardStream();
        const requested = panelTypes ? new Set(panelTypes) : null;
        const types = [...this.timers.keys()];
        
        for (const key of types) {
            const entry = this.timers.get(key);
            const entryPanels = entry?.panelTypes || [key];
            if (requested && !entryPanels.some(type => requested.has(type))) continue;
            if (entry) {
                clearTimeout(entry.timer || entry);
                this.timers.delete(key);
            }
        }
        
        const abortTypes = panelTypes || [...this.abortControllers.keys()];
        for (const type of abortTypes) {
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
    
    _storePanelResult(panelType, data, timestamp = Date.now()) {
        const fetcher = this.fetchers.get(panelType);
        this.cache.set(panelType, {
            data,
            timestamp,
            hash: this._computeHash(data)
        });
        
        if (fetcher) {
            fetcher.lastFetch = timestamp;
            fetcher.lastError = null;
            fetcher.consecutiveErrors = 0;
        }
        
        this._updateStats(panelType, true);
        
        return {
            data,
            fromCache: false,
            timestamp
        };
    }
    
    _canFetchViaDashboardSnapshot(panelType) {
        return DASHBOARD_SNAPSHOT_PANELS.has(panelType) && this.fetchers.has(panelType);
    }

    getDashboardStreamPanels(panelTypes) {
        return panelTypes.filter(type => this._canFetchViaDashboardSnapshot(type));
    }

    getDashboardPollingPanels(panelTypes) {
        return panelTypes.filter(type => !this._canFetchViaDashboardSnapshot(type));
    }
    
    async _fetchDashboardSnapshot(panelTypes, force = false) {
        const result = await signedRequest("/cli/dashboard/snapshot", {
            panels: panelTypes.join(","),
            lang: this.lang,
            force: force ? "1" : undefined
        });
        if (!result.data?.status) {
            throw new Error(result.data?.message || "Dashboard snapshot failed");
        }
        return result.data;
    }
    
    async _consumeDashboardStream(panelTypes, onUpdate, controller) {
        const response = await signedStreamRequest("/cli/dashboard/stream", {
            panels: panelTypes.join(","),
            lang: this.lang
        }, { signal: controller.signal });
        
        if (!response.ok) {
            throw new Error(`Dashboard stream failed with status ${response.status}`);
        }
        if (!response.body?.getReader) {
            throw new Error("Dashboard stream is not readable");
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        
        while (!controller.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) {
                throw new Error("Dashboard stream ended");
            }
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split(/\n\n/);
            buffer = parts.pop() || "";
            for (const part of parts) {
                this._handleDashboardStreamEvent(part, onUpdate);
            }
        }
    }

    async _runDashboardStream(panelTypes, onUpdate, onError, controller) {
        let failures = 0;
        while (!controller.signal.aborted) {
            try {
                await this._consumeDashboardStream(panelTypes, onUpdate, controller);
                failures = 0;
            } catch (error) {
                if (controller.signal.aborted) return;
                failures++;
                if (failures > this.dashboardStreamMaxRetries) {
                    console.debug("[DataFetcher] Dashboard stream error:", error.message);
                    if (this.dashboardStreamController === controller) this.dashboardStreamController = null;
                    try {
                        if (onError) onError(error);
                    } catch (callbackError) {
                        console.debug("[DataFetcher] Dashboard stream error handler failed:", callbackError.message);
                    }
                    return;
                }
                await delay(this.dashboardStreamRetryDelay * failures, controller.signal);
            }
        }
    }
    
    _handleDashboardStreamEvent(rawEvent, onUpdate) {
        const event = this._parseSseEvent(rawEvent);
        if (!event.data || event.event === "ready") return;
        
        if (event.event === "snapshot") {
            for (const [panelType, raw] of Object.entries(event.data.data || {})) {
                this._emitRawPanelUpdate(panelType, raw, onUpdate);
            }
            return;
        }
        
        if (event.event === "update" && event.data.panel) {
            this._emitRawPanelUpdate(event.data.panel, event.data.data, onUpdate);
        }
    }
    
    _emitRawPanelUpdate(panelType, raw, onUpdate) {
        const fetcher = this.fetchers.get(panelType);
        if (!fetcher || raw === undefined) return;
        const transformed = fetcher.transform ? fetcher.transform(raw, this.lang) : raw;
        const result = this._storePanelResult(panelType, transformed, Date.now());
        if (onUpdate) onUpdate(panelType, result);
    }
    
    _parseSseEvent(rawEvent) {
        let event = "message";
        const dataLines = [];
        for (const line of rawEvent.split(/\r?\n/)) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        try {
            return { event, data: dataLines.length > 0 ? JSON.parse(dataLines.join("\n")) : null };
        } catch {
            return { event, data: null };
        }
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
        this.stopDashboardStream();
    }
}

export { PANEL_FETCHERS };

function delay(ms, signal) {
    if (ms <= 0) return Promise.resolve();
    return new Promise(resolve => {
        const timer = setTimeout(resolve, ms);
        if (typeof timer.unref === "function") timer.unref();
        if (signal) {
            signal.addEventListener("abort", () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
        }
    });
}

export function formatBinanceMoverRows(result) {
    if (!result) return [];
    const timestamp = result.timestamp || new Date().toISOString();
    const formatRow = (item, idx, icon) => ({
        ...item,
        id: `${result.market}-${item.rankType}-${item.symbol}`,
        timestamp,
        hideTime: true,
        displayTitle: `${icon}${idx + 1} ${item.symbol} ${formatPercent(item.pctChange)} ${item.price} Vol ${item.volumeLabel}`,
        direction: item.direction
    });
    return [
        ...(result.gainers || []).map((item, idx) => formatRow(item, idx, "↑")),
        ...(result.losers || []).map((item, idx) => formatRow(item, idx, "↓"))
    ];
}

function formatPercent(value) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${value.toFixed(2)}%`;
}
