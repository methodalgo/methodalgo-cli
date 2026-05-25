import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/utils/api.js", () => ({
    signedRequest: vi.fn(),
    signedStreamRequest: vi.fn()
}));

vi.mock("../../src/utils/config-manager.js", () => ({
    default: {
        get: vi.fn(() => ({ refreshInterval: 60000 }))
    }
}));

vi.mock("../../src/utils/price-utils.js", () => ({
    fetchBinanceMovers: vi.fn(),
    fetchBinancePrice: vi.fn()
}));

describe("DataFetcher", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("fetchMultiple 优先使用 dashboard 聚合快照", async () => {
        const { signedRequest } = await import("../../src/utils/api.js");
        signedRequest.mockResolvedValue({
            data: {
                status: true,
                data: {
                    article: { status: true, data: [{ title: { en: "Market update" }, publish_date: "2026-05-02T00:00:00Z" }] },
                    breakout: [{
                        id: "1",
                        timestamp: "2026-05-02T00:00:00Z",
                        signals: [{ title: "Breakout For BTCUSDT", details: { Symbol: "BTCUSDT", Side: "up" } }]
                    }]
                },
                errors: {}
            }
        });

        const { DataFetcher } = await import("../../src/class/DataFetcher.js");
        const fetcher = new DataFetcher({ lang: "en" });
        const { results, errors } = await fetcher.fetchMultiple(["article", "breakout"]);

        expect(Object.keys(errors)).toHaveLength(0);
        expect(signedRequest).toHaveBeenCalledTimes(1);
        expect(signedRequest).toHaveBeenCalledWith("/cli/dashboard/snapshot", {
            panels: "article,breakout",
            lang: "en",
            force: undefined
        });
        expect(results.article.data[0].displayTitle).toBe("Market update");
        expect(results.breakout.data[0].displayTitle).toContain("Breakout UP For BTCUSDT");
    });

    it("聚合快照失败时回退到旧单面板接口", async () => {
        const { signedRequest } = await import("../../src/utils/api.js");
        signedRequest
            .mockRejectedValueOnce(new Error("snapshot down"))
            .mockResolvedValueOnce({
                data: { status: true, data: [{ title: { en: "Fallback news" }, publish_date: "2026-05-02T00:00:00Z" }] }
            });

        const { DataFetcher } = await import("../../src/class/DataFetcher.js");
        const fetcher = new DataFetcher({ lang: "en" });
        const { results, errors } = await fetcher.fetchMultiple(["article"]);

        expect(Object.keys(errors)).toHaveLength(0);
        expect(signedRequest).toHaveBeenCalledTimes(2);
        expect(signedRequest.mock.calls[1][0]).toBe("/cli/news");
        expect(results.article.data[0].displayTitle).toBe("Fallback news");
    });

    it("dashboard stream 正常结束后触发错误回调进入 fallback", async () => {
        const { signedStreamRequest } = await import("../../src/utils/api.js");
        signedStreamRequest.mockResolvedValue({
            ok: true,
            body: {
                getReader: () => ({
                    read: vi.fn().mockResolvedValue({ done: true })
                })
            }
        });

        const { DataFetcher } = await import("../../src/class/DataFetcher.js");
        const fetcher = new DataFetcher({
            lang: "en",
            dashboardStreamMaxRetries: 0,
            dashboardStreamRetryDelay: 0
        });
        const onError = vi.fn();

        expect(fetcher.startDashboardStream(["article"], vi.fn(), onError)).toBe(true);
        await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({
            message: "Dashboard stream ended"
        })));
    });

    it("dashboard stream 失败会先重试再进入 fallback", async () => {
        const { signedStreamRequest } = await import("../../src/utils/api.js");
        signedStreamRequest.mockResolvedValue({
            ok: true,
            body: {
                getReader: () => ({
                    read: vi.fn().mockResolvedValue({ done: true })
                })
            }
        });

        const { DataFetcher } = await import("../../src/class/DataFetcher.js");
        const fetcher = new DataFetcher({
            lang: "en",
            dashboardStreamMaxRetries: 1,
            dashboardStreamRetryDelay: 0
        });
        const onError = vi.fn();

        fetcher.startDashboardStream(["article"], vi.fn(), onError);
        await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
        expect(signedStreamRequest).toHaveBeenCalledTimes(2);
    });

    it("formats Binance movers into dashboard rows", async () => {
        const { fetchBinanceMovers } = await import("../../src/utils/price-utils.js");
        fetchBinanceMovers.mockResolvedValue({
            market: "spot",
            timestamp: "2026-05-03T00:00:00Z",
            gainers: [{ symbol: "AAAUSDT", pctChange: 12.345, price: "1.23", volumeLabel: "$10.0M", rankType: "gainer", direction: "bull" }],
            losers: [{ symbol: "BBBUSDT", pctChange: -9.876, price: "0.45", volumeLabel: "$2.0M", rankType: "loser", direction: "bear" }]
        });

        const { DataFetcher } = await import("../../src/class/DataFetcher.js");
        const fetcher = new DataFetcher({ lang: "en" });
        const result = await fetcher.fetch("binanceSpotMovers24h", true);

        expect(fetchBinanceMovers).toHaveBeenCalledWith({
            market: "spot",
            limit: 5,
            minQuoteVolume: 1000000,
            signal: expect.any(AbortSignal)
        });
        expect(result.data.map(item => item.displayTitle)).toEqual([
            "↑1 AAAUSDT +12.35% 1.23 Vol $10.0M",
            "↓1 BBBUSDT -9.88% 0.45 Vol $2.0M"
        ]);
        expect(result.data.every(item => item.hideTime)).toBe(true);
        expect(result.data[1].direction).toBe("bear");
    });

    it("preserves macro dashboard units and changes", async () => {
        const { signedRequest } = await import("../../src/utils/api.js");
        signedRequest.mockResolvedValue({
            data: {
                status: true,
                data: {
                    sections: {
                        rates: {
                            DGS10: {
                                title: "10-Year Treasury",
                                value: 4.52,
                                unit: "%",
                                change: -0.04,
                                date: "2026-05-22"
                            }
                        }
                    },
                    liquidity: {
                        NET_LIQ: {
                            value_billions: 5700,
                            change_billions: 25,
                            unit: "billions_usd",
                            date: "2026-05-22"
                        }
                    }
                }
            }
        });

        const { DataFetcher } = await import("../../src/class/DataFetcher.js");
        const fetcher = new DataFetcher({ lang: "en" });
        const result = await fetcher._fetchFred(null, new AbortController().signal);

        expect(result.rates.DGS10).toEqual(expect.objectContaining({
            label: "10-Year Treasury",
            value: 4.52,
            unit: "%",
            change: -0.04,
            date: "2026-05-22"
        }));
        expect(result.liquidity.NET_LIQ).toEqual(expect.objectContaining({
            label: "Net Liquidity",
            value: 5700,
            formatted: "$5.70T",
            unit: "billions_usd",
            change: 25
        }));
    });
});
