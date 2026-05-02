const BINANCE_API_BASE = "https://api.binance.com/api/v3";
const BINANCE_FUTURES_API_BASE = "https://fapi.binance.com/fapi/v1";
const DEFAULT_MOVERS_LIMIT = 5;
const DEFAULT_MIN_QUOTE_VOLUME = 1000000;

export function formatPrice(price) {
    if (price === undefined || price === null) return "--";
    if (price >= 1000) {
        return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
    } else if (price >= 1) {
        return price.toFixed(2);
    } else {
        return price.toFixed(4);
    }
}

export async function fetchBinancePrice(symbol, options = {}) {
    const { timeout = 10000, signal } = options;

    const controller = signal ? null : new AbortController();
    const actualSignal = signal || controller.signal;

    let timeoutId;
    if (!signal) {
        timeoutId = setTimeout(() => controller.abort(), timeout);
    }

    try {
        const priceRes = await fetch(
            `${BINANCE_API_BASE}/ticker/price?symbol=${encodeURIComponent(symbol)}`,
            { signal: actualSignal }
        );

        if (!priceRes.ok) {
            throw new Error(`Binance API error: ${priceRes.status}`);
        }

        const priceData = await priceRes.json();
        const price = Number(priceData.price);

        try {
            const statsController = new AbortController();
            const statsTimeout = setTimeout(() => statsController.abort(), timeout);

            const statsRes = await fetch(
                `${BINANCE_API_BASE}/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
                { signal: statsController.signal }
            );

            clearTimeout(statsTimeout);

            if (statsRes.ok) {
                const statsData = await statsRes.json();
                const change = Number(statsData.priceChange);
                const pctChange = Number(statsData.priceChangePercent);
                const direction = pctChange > 0.01 ? "up" : pctChange < -0.01 ? "down" : "flat";

                return {
                    symbol,
                    price: formatPrice(price),
                    rawPrice: price,
                    change,
                    pctChange,
                    direction,
                    timestamp: new Date().toISOString()
                };
            }
        } catch (e) {
        }

        return {
            symbol,
            price: formatPrice(price),
            rawPrice: price,
            change: 0,
            pctChange: 0,
            direction: null,
            timestamp: new Date().toISOString()
        };

    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

export async function fetchBinanceMovers(options = {}) {
    const {
        market = "spot",
        limit = DEFAULT_MOVERS_LIMIT,
        minQuoteVolume = DEFAULT_MIN_QUOTE_VOLUME,
        timeout = 10000,
        signal
    } = options;
    const controller = signal ? null : new AbortController();
    const actualSignal = signal || controller.signal;
    let timeoutId;

    if (!signal) {
        timeoutId = setTimeout(() => controller.abort(), timeout);
    }

    try {
        const data = await fetchBinanceTicker24hr(market, actualSignal);
        const tickers = normalizeBinanceMoverTickers(data, minQuoteVolume);
        const gainers = tickers
            .filter(item => item.pctChange > 0)
            .sort((a, b) => b.pctChange - a.pctChange)
            .slice(0, limit)
            .map(item => ({ ...item, rankType: "gainer", direction: "bull" }));
        const losers = tickers
            .filter(item => item.pctChange < 0)
            .sort((a, b) => a.pctChange - b.pctChange)
            .slice(0, limit)
            .map(item => ({ ...item, rankType: "loser", direction: "bear" }));

        return { market, gainers, losers, timestamp: new Date().toISOString() };
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

async function fetchBinanceTicker24hr(market, signal) {
    const baseUrl = market === "futures" ? BINANCE_FUTURES_API_BASE : BINANCE_API_BASE;
    const res = await fetch(`${baseUrl}/ticker/24hr`, { signal });
    if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
    return res.json();
}

export function normalizeBinanceMoverTickers(data, minQuoteVolume = DEFAULT_MIN_QUOTE_VOLUME) {
    const items = Array.isArray(data) ? data : data ? [data] : [];
    return items
        .map(item => {
            const symbol = String(item.symbol || "").toUpperCase();
            const pctChange = Number(item.priceChangePercent);
            const lastPrice = Number(item.lastPrice);
            const quoteVolume = Number(item.quoteVolume);
            return {
                symbol,
                pctChange,
                price: formatPrice(lastPrice),
                rawPrice: lastPrice,
                quoteVolume,
                volumeLabel: formatQuoteVolume(quoteVolume),
                openTime: item.openTime,
                closeTime: item.closeTime
            };
        })
        .filter(item => item.symbol.endsWith("USDT"))
        .filter(item => !/(UP|DOWN|BULL|BEAR)USDT$/u.test(item.symbol))
        .filter(item => Number.isFinite(item.pctChange) && Number.isFinite(item.rawPrice) && item.rawPrice > 0)
        .filter(item => Number.isFinite(item.quoteVolume) && item.quoteVolume >= minQuoteVolume);
}

export function formatQuoteVolume(value) {
    if (!Number.isFinite(value)) return "--";
    if (Math.abs(value) >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
}

export { BINANCE_API_BASE, BINANCE_FUTURES_API_BASE };
