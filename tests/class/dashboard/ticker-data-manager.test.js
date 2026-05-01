import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/utils/fred-api.js", () => ({
    getFredApiKey: vi.fn(() => ""),
    getSeriesObservations: vi.fn()
}));

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

    it("returns a placeholder when FRED key is missing", async () => {
        const { TickerDataManager } = await import("../../../src/class/Dashboard/ticker-data-manager.js");
        const manager = new TickerDataManager("en");
        const data = await manager.fetchSource({ type: "fred", series: "FEDFUNDS" });

        expect(data).toEqual({ value: "--", series: "FEDFUNDS", direction: null });
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
});
