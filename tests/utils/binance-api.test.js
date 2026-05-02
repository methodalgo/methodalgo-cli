import { describe, expect, it } from "vitest";
import {
    buildBinancePublicUrl,
    isBinancePublicEndpoint,
    isBinanceFuturesSymbol,
    normalizeBinanceEndpointPath,
    normalizeBinanceMarket,
    normalizeBinanceSymbol,
    parseBinanceParams,
    resolveBinanceMarket
} from "../../src/utils/binance-api.js";

describe("binance-api helpers", () => {
    it("normalizes market aliases and symbols", () => {
        expect(normalizeBinanceMarket("spot")).toBe("spot");
        expect(normalizeBinanceMarket("perp")).toBe("futures");
        expect(normalizeBinanceSymbol("btcusdt.p")).toBe("BTCUSDT");
        expect(isBinanceFuturesSymbol("BTCUSDT.P")).toBe(true);
        expect(resolveBinanceMarket("BTCUSDT.P")).toBe("futures");
        expect(resolveBinanceMarket("BTCUSDT")).toBe("spot");
        expect(resolveBinanceMarket("BTCUSDT.P", "spot")).toBe("spot");
    });

    it("builds normal Binance API URLs without vision endpoints", () => {
        expect(buildBinancePublicUrl("ticker/24hr", {
            market: "spot",
            params: { symbol: "BTCUSDT" }
        })).toBe("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");

        expect(buildBinancePublicUrl("openInterest", {
            market: "futures",
            params: { symbol: "BTCUSDT" }
        })).toBe("https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT");

        expect(buildBinancePublicUrl("globalLongShortAccountRatio", {
            endpointGroup: "futuresData",
            params: { symbol: "BTCUSDT", period: "5m" }
        })).toBe("https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m");
    });

    it("keeps full public endpoint paths and blocks unsupported private paths", () => {
        expect(normalizeBinanceEndpointPath("/fapi/v1/ticker/24hr", "spot")).toBe("/fapi/v1/ticker/24hr");
        expect(isBinancePublicEndpoint("/fapi/v1/historicalTrades", { market: "futures" })).toBe(false);
        expect(isBinancePublicEndpoint("/api/v3/historicalTrades", { market: "spot" })).toBe(true);
    });

    it("parses raw query parameters", () => {
        expect(parseBinanceParams(["symbol=BTCUSDT", "limit=5", "bad"])).toEqual({
            symbol: "BTCUSDT",
            limit: "5"
        });
    });
});
