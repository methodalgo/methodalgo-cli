import { cleanText } from "../../utils/dashboard-utils.js";

export function transformNews(data, lang) {
    if (!data?.status) return [];
    return (data.data || [])
        .filter(item => item && (item.title || item.displayTitle))
        .map(item => ({
            ...item,
            displayTitle: pickLocalizedText(item.title, lang),
            timestamp: item.ts || item.timestamp || item.updatedAt || item.publish_date || new Date().toISOString()
        }))
        .filter(item => item.displayTitle?.trim().length > 0);
}

export function transformBreakout(items, lang) {
    return items.map(item => {
        const sig = item.signals?.[0] || {};
        const details = sig.details || {};
        const tfStr = formatTimeFrame(sig, details);
        const symbol = extractSymbol(sig, details);
        const side = (details.Side || details.side || "").toLowerCase();
        const type = (details.Type || details.type || "").toLowerCase();
        const direction = item.direction || sig.direction || "";
        const isDown = side.includes("down") || direction === "bear" || type.includes("down");
        const isUp = side.includes("up") || direction === "bull" || type.includes("up");
        const dirStr = isUp ? "UP" : isDown ? "DOWN" : "";
        const finalDirection = isDown ? "bear" : isUp ? "bull" : direction;
        const baseTitle = sig.title || item.displayTitle || item.title || "";
        const cleanTitle = cleanText(pickLocalizedText(baseTitle, lang));
        const finalTitle = symbol ? `${tfStr}Breakout ${dirStr} For ${symbol}` : cleanTitle;
        return normalizePanelItem(item, finalDirection, finalTitle);
    }).filter(item => item.displayTitle?.length > 0);
}

export function transformExhaustion(items, lang) {
    return items.map(item => {
        const sig = item.signals?.[0] || {};
        const details = sig.details || {};
        const tfStr = formatTimeFrame(sig, details);
        const symbol = extractSymbol(sig, details);
        const baseTitle = sig.title || item.displayTitle || item.title || "";
        const cleanTitle = cleanText(pickLocalizedText(baseTitle, lang));
        let direction = item.direction || sig.direction || "";
        const lowerTitle = cleanTitle.toLowerCase();
        if (lowerTitle.includes("seller")) direction = "bull";
        if (lowerTitle.includes("buyer")) direction = "bear";
        const pureTitle = cleanTitle.replace(/for\s+[\w.*-]+/i, "").trim();
        const finalTitle = symbol ? `${tfStr}${pureTitle} For ${symbol}` : `${tfStr}${pureTitle}`;
        return normalizePanelItem(item, direction, finalTitle);
    }).filter(item => item.displayTitle?.length > 0);
}

export function transformGoldenPit(items, lang) {
    return items.map(item => {
        const sig = item.signals?.[0] || {};
        const details = sig.details || {};
        const tfStr = formatTimeFrame(sig, details);
        const symbol = extractSymbol(sig, details);
        const direction = item.direction || sig.direction || "";
        const dirStr = direction === "bull" ? "Bull" : direction === "bear" ? "Bear" : "";
        const finalTitle = symbol ? `${tfStr}${dirStr} Golden Pit For ${symbol}` : `${tfStr}${dirStr} Golden Pit`;
        return normalizePanelItem(item, direction, finalTitle);
    }).filter(item => item.displayTitle?.length > 0);
}

export function transformLiquidation(items, lang) {
    return items.map(item => {
        const sig = item.signals?.[0] || {};
        const details = sig.details || {};
        const tfStr = formatTimeFrame(sig, details);
        const symbol = extractSymbol(sig, details);
        const side = (details.Side || details.side || "").toLowerCase();
        const direction = item.direction || sig.direction || "";
        const isLong = side.includes("sell") || direction === "bear";
        const isShort = side.includes("buy") || direction === "bull";
        const sideStr = isLong ? "LONG" : isShort ? "SHORT" : "";
        const finalDirection = isLong ? "bear" : isShort ? "bull" : direction;
        const finalTitle = symbol ? `${tfStr}${sideStr} Liquidation For ${symbol}` : `${tfStr}${sideStr} Liquidation`;
        return normalizePanelItem(item, finalDirection, finalTitle);
    }).filter(item => item.displayTitle?.length > 0);
}

export function transformMarketToday(data, lang) {
    const raw = data?.data || (Array.isArray(data) ? data : null);
    if (!raw) return [];
    return (Array.isArray(raw) ? raw : [raw]).filter(Boolean).map(item => {
        const sigTitle = item.signals?.[0]?.title || "";
        const baseTitle = item.title || item.displayTitle || sigTitle || item.content || item.description || "";
        const cleanTitle = cleanText(pickLocalizedText(baseTitle, lang));
        return {
            ...item,
            timestamp: item.ts || item.timestamp || item.updatedAt || new Date().toISOString(),
            displayTitle: cleanTitle
        };
    }).filter(item => item.displayTitle?.length > 0);
}

export function transformTokenUnlock(data) {
    let items = null;
    if (data?.data?.signals && Array.isArray(data.data.signals)) items = data.data.signals;
    else if (data?.data && Array.isArray(data.data)) items = data.data;
    else if (Array.isArray(data)) items = data;
    if (!items) return [];
    return items.filter(Boolean).map(item => {
        const sym = cleanText(item.symbol || "");
        const perc = item.perc || "";
        const val = cleanText((item.unlockValue || item.unlockTokenVal || "").split("(")[0]);
        const rawTs = item.ts || item.timestamp || data?.updatedAt;
        const finalTs = (typeof rawTs === "number" && rawTs < 10000000000) ? rawTs * 1000 : rawTs;
        return {
            ...item,
            timestamp: finalTs || new Date().toISOString(),
            displayTitle: sym ? `${sym} ${perc}% ${val}` : ""
        };
    }).filter(item => item.displayTitle?.length > 0);
}

export function transformFredData(data) {
    if (!data) return [];
    if (data.error) {
        return [{ displayTitle: data.error, timestamp: new Date().toISOString() }];
    }
    return [
        ...formatFredSection(data.rates, 0.001, val => `${val.value.toFixed(2)}${val.unit || ""}`),
        ...formatFredSection(data.market, 0.01, val => val.formatted || `${val.value.toFixed(2)}${val.unit || ""}`),
        ...formatFredSection(data.liquidity, null, val => val.formatted || val.value),
        ...formatFredSection(data.other, 0.001, val => `${val.value.toFixed(2)}${val.unit || ""}`),
        ...formatFredSection(data.inflation, null, val => `${val.value.toFixed(2)}%`)
    ];
}

export function transformPriceData(data) {
    return data || [];
}

export function transformCalendarData(data) {
    return data || [];
}

export function extractTimeFrame(sig, details) {
    let tf = details?.TimeFrame || details?.Timeframe || details?.tf || details?.TF || details?.interval || "";
    if (!tf && sig?.description) {
        const match = sig.description.match(/TimeFrame:\s*(\w+)/i);
        if (match) tf = match[1];
    }
    return tf;
}

function formatFredSection(section, arrowThreshold, formatValue) {
    if (!section) return [];
    return Object.values(section).filter(val => val && val.value !== undefined).map(val => {
        const arrow = arrowThreshold === null
            ? ""
            : val.change > arrowThreshold ? " ↑" : val.change < -arrowThreshold ? " ↓" : "";
        return {
            displayTitle: `${val.label}: ${formatValue(val)}${arrow}`,
            timestamp: val.date || new Date().toISOString()
        };
    });
}

function formatTimeFrame(sig, details) {
    const tf = extractTimeFrame(sig, details);
    return tf ? `[${tf}] ` : "";
}

function extractSymbol(sig, details) {
    let symbol = cleanText(details.Symbol || details.symbol || "");
    if (!symbol) {
        const match = (sig.title || "").match(/For\s+([\w.*-]+)/i);
        if (match) symbol = match[1];
    }
    return symbol;
}

function normalizePanelItem(item, direction, displayTitle) {
    return {
        ...item,
        direction,
        displayTitle: displayTitle.replace(/\s+/g, " ").trim(),
        timestamp: item.ts || item.timestamp || item.updatedAt || item.publish_date || new Date().toISOString()
    };
}

function pickLocalizedText(value, lang) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return value[lang] || value.en || value.zh || "";
    return "";
}
