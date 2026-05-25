import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/utils/api.js", () => ({
    signedRequest: vi.fn()
}));

vi.mock("../../../src/utils/price-utils.js", () => ({
    fetchBinancePrice: vi.fn()
}));

describe("TickerDataManager", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("formats custom ticker source text", async () => {
        const { TickerDataManager } = await import("../../../src/class/Dashboard/ticker-data-manager.js");
        const manager = new TickerDataManager("en");
        const data = await manager.fetchSource({ type: "custom", text: "Market open" });
        const formatted = manager.formatSource({ type: "custom", format: "{value}" }, data);

        expect(data).toEqual({ text: "Market open" });
        expect(formatted.text).toBe("Market open");
    });

    it("fetches FRED ticker values through the macro endpoint", async () => {
        const { signedRequest } = await import("../../../src/utils/api.js");
        signedRequest.mockResolvedValue({
            data: {
                status: true,
                data: {
                    data: [
                        { date: "2026-05-01", value: 4.9 },
                        { date: "2026-05-02", value: 5.0, change: 0.1 }
                    ]
                }
            }
        });
        const { TickerDataManager } = await import("../../../src/class/Dashboard/ticker-data-manager.js");
        const manager = new TickerDataManager("en");
        const data = await manager.fetchSource({ type: "fred", series: "FEDFUNDS" });

        expect(signedRequest).toHaveBeenCalledWith("/cli/macro", { type: "fred-changes", seriesId: "FEDFUNDS", periods: 2 });
        expect(data).toEqual({ value: "5.00", series: "FEDFUNDS", direction: "up", change: 0.1, date: "2026-05-02" });
    });

    it("formats arrays from news sources", async () => {
        const { signedRequest } = await import("../../../src/utils/api.js");
        signedRequest.mockResolvedValue({
            data: {
                status: true,
                data: [
                    { title: { en: "ETF flows rise" }, timestamp: "2026-05-01T10:00:00Z" }
                ]
            }
        });

        const { TickerDataManager } = await import("../../../src/class/Dashboard/ticker-data-manager.js");
        const manager = new TickerDataManager("en");
        const source = { type: "news", typeFilter: "breaking", limit: 1, format: "News: {title}" };
        const data = await manager.fetchSource(source);
        const formatted = manager.formatSource(source, data);

        expect(formatted).toEqual([
            expect.objectContaining({ text: "News: ETF flows rise" })
        ]);
    });

    it("uses dashboard cache for news ticker sources before calling the API", async () => {
        const { signedRequest } = await import("../../../src/utils/api.js");
        const { TickerDataManager } = await import("../../../src/class/Dashboard/ticker-data-manager.js");
        const manager = new TickerDataManager("en");

        const result = await manager.fetchSource(
            { type: "news", typeFilter: "breaking", limit: 2 },
            0,
            {
                breaking: [
                    { displayTitle: "BTC ETF flow update", url: "https://example.com/a", timestamp: "2026-05-03T00:00:00Z" },
                    { displayTitle: "SOL unlock watch", url: "https://example.com/b", timestamp: "2026-05-03T00:01:00Z" }
                ]
            }
        );

        expect(result).toEqual([
            { title: "BTC ETF flow update", url: "https://example.com/a", timestamp: "2026-05-03T00:00:00Z" },
            { title: "SOL unlock watch", url: "https://example.com/b", timestamp: "2026-05-03T00:01:00Z" }
        ]);
        expect(signedRequest).not.toHaveBeenCalled();
    });
});
