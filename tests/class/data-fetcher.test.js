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

vi.mock("../../src/utils/fred-api.js", () => ({
    getFredApiKey: vi.fn(() => ""),
    getSeriesObservations: vi.fn()
}));

vi.mock("../../src/utils/price-utils.js", () => ({
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
});
