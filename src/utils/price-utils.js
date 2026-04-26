const BINANCE_API_BASE = "https://api.binance.com/api/v3";

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

export { BINANCE_API_BASE };
