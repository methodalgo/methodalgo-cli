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
            const signalChannels = ["breakout-htf", "breakout-mtf", "exhaustion-buyer", "exhaustion-seller", "golden-pit-ltf", "golden-pit-mtf", "liquidation", "market-today", "token-unlock"];
            
            const results = await Promise.allSettled([
                ...newsTypes.map(t => signedRequest("/cli/news", { type: t, limit: 30, lang: this.lang })),
                ...signalChannels.map(c => signedRequest("/cli/signals", { channelName: c, limit: 30, lang: this.lang }))
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
                    if (Array.isArray(d)) items = d.filter(item => item && (item.signals || item.displayTitle || item.title));
                    else if (d && Array.isArray(d.signals)) {
                        items = d.signals.map((s, idx) => ({
                            id: `compat-${c}-${idx}`,
                            timestamp: d.updatedAt || new Date().toISOString(),
                            signals: [s]
                        }));
                    } else if (d && Object.keys(d).length > 0) items = [d];
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
            this.caches.marketToday = getSig("market-today");
            this.caches.tokenUnlock = getSig("token-unlock");

            // ── Normalization & Sorting ──────────
            for (const k in this.caches) {
                if (Array.isArray(this.caches[k])) {
                    if (!["article", "breaking", "onchain", "report"].includes(k)) {
                        this.caches[k] = this.caches[k].map(item => this.formatItem(k, item)).filter(item => item && item.displayTitle.length > 0);
                    }
                    // Sort descending by time
                    this.caches[k].sort((a, b) => {
                        const ta = new Date(a.publish_date || a.timestamp).getTime();
                        const tb = new Date(b.publish_date || b.timestamp).getTime();
                        return tb - ta;
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
        let baseTitle = cleanText(sig.title || item.displayTitle || "");
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
            if (symbol) finalTitle = `${tfStr}Breakout ${dirStr} For ${symbol}`;
        } else if (category === "goldenPit") {
            const dirStr = direction === "bull" ? "Bull" : direction === "bear" ? "Bear" : "";
            if (symbol) finalTitle = `${tfStr}${dirStr} Golden Pit For ${symbol}`;
        } else if (category === "liquidation") {
            const isLong = side.includes("sell") || direction === "bear";
            const isShort = side.includes("buy") || direction === "bull";
            const sideStr = isLong ? "LONG" : isShort ? "SHORT" : "";
            if (symbol) finalTitle = `${tfStr}${sideStr} Liquidation For ${symbol}`;
        } else if (category === "exhaustion") {
            let pureTitle = baseTitle.replace(/for\s+[\w.*-]+/i, "").trim();
            finalTitle = `${tfStr}${pureTitle} For ${symbol}`;
        } else {
            finalTitle = `${tfStr}${baseTitle}`;
        }

        return { ...item, direction, displayTitle: finalTitle.replace(/\s+/g, " ").trim() };
    }
}
