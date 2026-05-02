import { afterEach, describe, expect, it, vi } from "vitest";
import {
    fetchBinanceMovers,
    formatQuoteVolume,
    normalizeBinanceMoverTickers
} from "../../src/utils/price-utils.js";

describe("price-utils Binance movers", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("normalizes USDT tickers and filters low volume or leveraged symbols", () => {
        const result = normalizeBinanceMoverTickers([
            { symbol: "AAAUSDT", priceChangePercent: "12.3", lastPrice: "1.234", quoteVolume: "5000000" },
            { symbol: "BBBUPUSDT", priceChangePercent: "20", lastPrice: "1", quoteVolume: "9000000" },
            { symbol: "CCCUSDT", priceChangePercent: "3", lastPrice: "0.5", quoteVolume: "10" },
            { symbol: "DDDBTC", priceChangePercent: "5", lastPrice: "0.1", quoteVolume: "5000000" }
        ]);

        expect(result).toEqual([expect.objectContaining({
            symbol: "AAAUSDT",
            pctChange: 12.3,
            price: "1.23",
            volumeLabel: "$5.0M"
        })]);
    });

    it("fetches spot and futures Binance movers from the correct endpoints", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue([
                { symbol: "GAINUSDT", priceChangePercent: "8", lastPrice: "2", quoteVolume: "2000000" },
                { symbol: "LOSEUSDT", priceChangePercent: "-6", lastPrice: "3", quoteVolume: "3000000" }
            ])
        });

        const spot = await fetchBinanceMovers({ market: "spot", limit: 1 });
        const futures = await fetchBinanceMovers({ market: "futures", limit: 1 });

        expect(fetchMock.mock.calls[0][0]).toContain("/ticker/24hr");
        expect(fetchMock.mock.calls[0][0]).toContain("api.binance.com/api/v3");
        expect(fetchMock.mock.calls[1][0]).toContain("/ticker/24hr");
        expect(fetchMock.mock.calls[1][0]).toContain("fapi.binance.com/fapi/v1");
        expect(spot.gainers[0].symbol).toBe("GAINUSDT");
        expect(spot.losers[0].symbol).toBe("LOSEUSDT");
        expect(futures.market).toBe("futures");
    });

    it("formats quote volume compactly", () => {
        expect(formatQuoteVolume(1234567890)).toBe("$1.23B");
        expect(formatQuoteVolume(1234567)).toBe("$1.2M");
        expect(formatQuoteVolume(1234)).toBe("$1.2K");
    });
});
