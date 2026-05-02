export const BINANCE_MARKETS = {
    spot: { id: "spot", label: "Spot", baseUrl: "https://api.binance.com/api/v3" },
    futures: { id: "futures", label: "USD-M Futures", baseUrl: "https://fapi.binance.com/fapi/v1" },
    futuresData: { id: "futuresData", label: "USD-M Futures Data", baseUrl: "https://fapi.binance.com/futures/data" }
};

const BINANCE_ROOTS = {
    "/api/v3": "https://api.binance.com",
    "/fapi/v1": "https://fapi.binance.com",
    "/fapi/v2": "https://fapi.binance.com",
    "/futures/data": "https://fapi.binance.com"
};

const BINANCE_PUBLIC_PATHS = new Set([
    "/api/v3/ping",
    "/api/v3/time",
    "/api/v3/exchangeInfo",
    "/api/v3/depth",
    "/api/v3/trades",
    "/api/v3/historicalTrades",
    "/api/v3/aggTrades",
    "/api/v3/klines",
    "/api/v3/uiKlines",
    "/api/v3/avgPrice",
    "/api/v3/ticker",
    "/api/v3/ticker/24hr",
    "/api/v3/ticker/tradingDay",
    "/api/v3/ticker/price",
    "/api/v3/ticker/bookTicker",
    "/fapi/v1/ping",
    "/fapi/v1/time",
    "/fapi/v1/exchangeInfo",
    "/fapi/v1/depth",
    "/fapi/v1/trades",
    "/fapi/v1/aggTrades",
    "/fapi/v1/klines",
    "/fapi/v1/continuousKlines",
    "/fapi/v1/indexPriceKlines",
    "/fapi/v1/markPriceKlines",
    "/fapi/v1/premiumIndexKlines",
    "/fapi/v1/premiumIndex",
    "/fapi/v1/fundingRate",
    "/fapi/v1/fundingInfo",
    "/fapi/v1/ticker/24hr",
    "/fapi/v1/ticker/price",
    "/fapi/v2/ticker/price",
    "/fapi/v1/ticker/bookTicker",
    "/fapi/v1/openInterest",
    "/fapi/v1/constituents",
    "/fapi/v1/assetIndex",
    "/futures/data/openInterestHist",
    "/futures/data/globalLongShortAccountRatio",
    "/futures/data/topLongShortAccountRatio",
    "/futures/data/topLongShortPositionRatio",
    "/futures/data/takerlongshortRatio",
    "/futures/data/basis"
]);

export function normalizeBinanceMarket(market = "spot") {
    const value = String(market || "spot").toLowerCase();
    if (["future", "futures", "contract", "perp", "perpetual", "um"].includes(value)) return "futures";
    return "spot";
}

export function isBinanceFuturesSymbol(symbol = "") {
    return /\.P$/iu.test(String(symbol || "").trim());
}

export function resolveBinanceMarket(symbol = "", market = "auto") {
    const value = String(market || "auto").toLowerCase();
    if (value === "auto") return isBinanceFuturesSymbol(symbol) ? "futures" : "spot";
    return normalizeBinanceMarket(value);
}

export function getBinanceBaseUrl(market = "spot") {
    return BINANCE_MARKETS[normalizeBinanceMarket(market)].baseUrl;
}

export function normalizeBinanceSymbol(symbol = "") {
    return String(symbol || "").trim().toUpperCase().replace(/\.P$/u, "");
}

export async function binancePublicGet(path, options = {}) {
    const {
        market = "spot",
        endpointGroup,
        params = {},
        timeout = 10000,
        signal,
        allowRaw = false
    } = options;
    const controller = signal ? null : new AbortController();
    const actualSignal = signal || controller.signal;
    let timeoutId;

    if (!signal) {
        timeoutId = setTimeout(() => controller.abort(), timeout);
    }

    try {
        const url = buildBinancePublicUrl(path, { market, endpointGroup, params, allowRaw });
        const res = await fetch(url, { signal: actualSignal });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`Binance API error: ${res.status}${body ? ` ${body}` : ""}`);
        }
        return res.json();
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

export function buildBinancePublicUrl(path, options = {}) {
    const {
        market = "spot",
        endpointGroup,
        params = {},
        allowRaw = false
    } = typeof options === "string" ? { market: options } : options;
    const endpoint = String(path || "").trim();
    if (!endpoint) throw new Error("Missing Binance endpoint path");
    const normalizedPath = normalizeBinanceEndpointPath(endpoint, market, endpointGroup);
    if (!allowRaw && !BINANCE_PUBLIC_PATHS.has(normalizedPath)) {
        throw new Error(`Unsupported Binance public endpoint: ${normalizedPath}`);
    }

    const root = getBinanceRootForPath(normalizedPath);
    const url = new URL(`${root}${normalizedPath}`);

    for (const [key, value] of Object.entries(params || {})) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
    }

    return url.toString();
}

export function normalizeBinanceEndpointPath(path, market = "spot", endpointGroup) {
    const endpoint = String(path || "").trim();
    const withSlash = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    if (Object.keys(BINANCE_ROOTS).some(prefix => withSlash.startsWith(prefix))) return withSlash;
    if (endpointGroup === "futuresData") return `/futures/data${withSlash}`;
    const normalizedMarket = normalizeBinanceMarket(market);
    return normalizedMarket === "futures" ? `/fapi/v1${withSlash}` : `/api/v3${withSlash}`;
}

export function getBinanceRootForPath(path) {
    const normalizedPath = String(path || "");
    const prefix = Object.keys(BINANCE_ROOTS)
        .sort((a, b) => b.length - a.length)
        .find(item => normalizedPath.startsWith(item));
    if (!prefix) throw new Error(`Unsupported Binance endpoint path: ${path}`);
    return BINANCE_ROOTS[prefix];
}

export function isBinancePublicEndpoint(path, options = {}) {
    return BINANCE_PUBLIC_PATHS.has(normalizeBinanceEndpointPath(path, options.market, options.endpointGroup));
}

export function parseBinanceParams(pairs = []) {
    const params = {};
    for (const pair of pairs || []) {
        const raw = String(pair || "");
        const idx = raw.indexOf("=");
        if (idx <= 0) continue;
        const key = raw.slice(0, idx).trim();
        const value = raw.slice(idx + 1).trim();
        if (key) params[key] = value;
    }
    return params;
}
