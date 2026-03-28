import { signedRequest } from "../utils/api.js";
import { cleanText } from "../utils/dashboard-utils.js";

export class DashboardManager {
    constructor(lang) {
        this.lang = lang;
        this.caches = {
            article: [], breaking: [], onchain: [], report: [],
            breakout: [], exhaustion: [], goldenPit: [], liquidation: [],
            marketToday: [], tokenUnlock: []
        };
        this.statusInfo = { time: "", mem: "0", error: null };
    }

    async fetchData() {
        try {
            const newsTypes = ["article", "breaking", "onchain", "report"];
            const signalChannels = ["breakout-htf", "breakout-mtf", "exhaustion-buyer", "exhaustion-seller", "golden-pit-ltf", "golden-pit-mtf", "liquidation"];
            const results = await Promise.allSettled([
                ...newsTypes.map(t => signedRequest("/cli/news", { type: t, limit: 30, lang: this.lang })),
                ...signalChannels.map(c => signedRequest("/cli/signals", { channelName: c, limit: 30, lang: this.lang })),
                signedRequest("/cli/signals", { channelName: "market-today", limit: 30, lang: this.lang }),
                signedRequest("/cli/signals", { channelName: "token-unlock", limit: 30, lang: this.lang })
            ]);

            const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
            
            // ── News Processing ─────────────────
            newsTypes.forEach((type, i) => {
                const res = results[i];
                if (res.status === "fulfilled" && res.value.data.status) {
                    this.caches[type] = res.value.data.data
                        .filter(item => item && (item.title || item.displayTitle))
                        .map(item => ({
                            ...item,
                            displayTitle: typeof item.title === "object" ? (item.title[this.lang] || item.title.en || "") : (item.title || "")
                        }))
                        .filter(item => item.displayTitle.trim().length > 0);
                }
            });

            // ── Signals Processing ───────────────
            const sigOffset = newsTypes.length;
            const sigData = {};

            signalChannels.forEach((c, i) => {
                const res = results[sigOffset + i];
                if (res?.status === "fulfilled" && res.value.data.status) {
                    const d = res.value.data.data;
                    let items = [];
                    if (Array.isArray(d)) {
                        // 修正：特定频道（如 token-unlock, market-today）不一定含有 signals 数组，可能是原始数据库记录
                        const isDatabaseRoot = ["token-unlock", "market-today"].includes(c);
                        items = d.filter(item => item && (isDatabaseRoot || item.signals || item.displayTitle || item.title))
                            .map(item => ({ 
                                ...item, 
                                timestamp: item.ts || item.timestamp || item.updatedAt || item.publish_date || new Date().toISOString() 
                            }));
                    } else if (d && Array.isArray(d.signals)) {
                        items = d.signals.map((s, idx) => ({
                            id: `compat-${c}-${idx}`,
                            timestamp: d.updatedAt || d.timestamp || d.publish_date || new Date().toISOString(),
                            signals: [s]
                        }));
                    } else if (d && Object.keys(d).length > 0) {
                        items = [{ ...d, timestamp: d.ts || d.timestamp || d.publish_date || d.updatedAt || new Date().toISOString() }];
                    }
                    sigData[c] = items;
                } else {
                    sigData[c] = [];
                }
            });

            const getSig = c => sigData[c] || [];

            this.caches.breakout = [...getSig("breakout-htf"), ...getSig("breakout-mtf")];
            this.caches.exhaustion = [...getSig("exhaustion-buyer"), ...getSig("exhaustion-seller")];
            this.caches.goldenPit = [...getSig("golden-pit-ltf"), ...getSig("golden-pit-mtf")];
            this.caches.liquidation = getSig("liquidation");

            // ── Market Today Isolation ─────────
            const resMarket = results[sigOffset + signalChannels.length];
            if (resMarket?.status === "fulfilled") {
                const raw = resMarket.value.data;
                const d = raw.data || (Array.isArray(raw) ? raw : null);
                if (d) {
                    this.caches.marketToday = (Array.isArray(d) ? d : [d]).filter(Boolean).map(item => {
                        const sigTitle = item.signals?.[0]?.title || "";
                        return {
                            ...item,
                            timestamp: item.ts || item.timestamp || item.updatedAt || new Date().toISOString(),
                            displayTitle: cleanText(item.title || item.displayTitle || sigTitle || item.content || item.description || "")
                        };
                    }).filter(item => item.displayTitle.length > 0);
                }
            }

            // ── Token Unlock Isolation ─────────
            const resUnlock = results[sigOffset + signalChannels.length + 1];
            if (resUnlock?.status === "fulfilled") {
                const raw = resUnlock.value.data;
                const inner = raw.data;
                const d = (inner && Array.isArray(inner.signals)) ? inner.signals :
                          (inner && Array.isArray(inner.data)) ? inner.data :
                          (Array.isArray(inner) ? inner : 
                          (Array.isArray(raw) ? raw : null));
                
                if (d) {
                    this.caches.tokenUnlock = d.filter(Boolean).map(item => {
                        const sym = cleanText(item.symbol || "");
                        const perc = item.perc || "";
                        const val = cleanText((item.unlockValue || item.unlockTokenVal || "").split('(')[0]);
                        // 强制选用 ts (毫秒或秒)，如果是秒则转为毫秒。如果都缺失则回退到当前
                        const rawTs = item.ts || item.timestamp || inner?.updatedAt;
                        const finalTs = (typeof rawTs === 'number' && rawTs < 10000000000) ? rawTs * 1000 : rawTs;
                        
                        return {
                            ...item,
                            timestamp: finalTs || new Date().toISOString(),
                            displayTitle: sym ? `${sym} ${perc}% ${val}` : ""
                        };
                    }).filter(item => item.displayTitle.length > 0);
                }
            }

            // ── Normalization & Sorting ──────────
            for (const k in this.caches) {
                if (Array.isArray(this.caches[k])) {
                    // 仅对非 isolation 模块（常规信号）执行 formatItem
                    if (!["article", "breaking", "onchain", "report", "marketToday", "tokenUnlock"].includes(k)) {
                        this.caches[k] = this.caches[k].map(item => this.formatItem(k, item)).filter(item => item && item.displayTitle.length > 0);
                    }
                    
                    // 排序逻辑：
                    // 代币解锁(tokenUnlock): 升序 (距离现在最近的未来事件排在前)
                    // 其他: 降序 (最新的历史记录排在前)
                    this.caches[k].sort((a, b) => {
                        const ta = new Date(a.publish_date || a.timestamp).getTime();
                        const tb = new Date(b.publish_date || b.timestamp).getTime();
                        return k === "tokenUnlock" ? ta - tb : tb - ta;
                    });
                }
            }

            this.statusInfo = { time: new Date().toLocaleTimeString(), mem, error: null };
            return { caches: { ...this.caches }, statusInfo: { ...this.statusInfo } };
        } catch (e) {
            this.statusInfo.error = e.message;
            throw e;
        }
    }

    formatItem(category, item) {
        if (!item) return null;
        const sig = item.signals?.[0] || {};
        const details = sig.details || {};
        const desc = sig.description || "";
        
        // 🛠️ TF Extraction
        let tf = details.TimeFrame || details.Timeframe || details.tf || details.TF || details.interval || "";
        if (!tf && desc) {
            const m = desc.match(/TimeFrame:\s*(\w+)/i);
            if (m) tf = m[1];
        }
        const tfStr = tf ? `[${tf}] ` : "";

        // 🛠️ Title Cleaning
        const extractTitle = (obj) => {
            if (!obj) return "";
            if (typeof obj === "string") return obj;
            if (typeof obj === "object") return obj[this.lang] || obj.en || obj.zh || "";
            return "";
        };

        const rawTitle = sig.title || item.displayTitle || item.title || "";
        let baseTitle = cleanText(extractTitle(rawTitle));
        let direction = sig.direction || item.direction || "";

        // 🛠️ Symbol Extraction
        let symbol = cleanText(details.Symbol || details.symbol || "");
        if (!symbol) {
            const match = baseTitle.match(/For\s+([\w.*-]+)/i);
            if (match) symbol = match[1];
        }
        
        const side = (details.Side || details.side || "").toLowerCase();
        const type = (details.Type || details.type || "").toLowerCase();

        let finalTitle = baseTitle;

        if (category === "breakout") {
            const isDown = side.includes("down") || direction === "bear" || type.includes("down");
            const isUp = side.includes("up") || direction === "bull" || type.includes("up");
            const dirStr = isUp ? "UP" : isDown ? "DOWN" : "";
            if (isDown) direction = "bear";
            if (isUp) direction = "bull";
            if (symbol) finalTitle = `${tfStr}Breakout ${dirStr} For ${symbol}`;
        } else if (category === "goldenPit") {
            const dirStr = direction === "bull" ? "Bull" : direction === "bear" ? "Bear" : "";
            if (symbol) finalTitle = `${tfStr}${dirStr} Golden Pit For ${symbol}`;
        } else if (category === "liquidation") {
            const isLong = side.includes("sell") || direction === "bear";
            const isShort = side.includes("buy") || direction === "bull";
            const sideStr = isLong ? "LONG" : isShort ? "SHORT" : "";
            if (isLong) direction = "bear";
            if (isShort) direction = "bull";
            if (symbol) finalTitle = `${tfStr}${sideStr} Liquidation For ${symbol}`;
        } else if (category === "exhaustion") {
            let pureTitle = baseTitle.replace(/for\s+[\w.*-]+/i, "").trim();
            finalTitle = `${tfStr}${pureTitle} For ${symbol}`;
            if (pureTitle.toLowerCase().includes("seller")) direction = "bull";
            if (pureTitle.toLowerCase().includes("buyer")) direction = "bear";
        } else if (category === "marketToday") {
            // 🛠️ 如果是 marketToday，直接使用 baseTitle
            finalTitle = baseTitle || item.content || item.description || "";
        } else {
            finalTitle = `${tfStr}${baseTitle}`;
        }

        return { ...item, direction, displayTitle: finalTitle.replace(/\s+/g, " ").trim() };
    }
}
