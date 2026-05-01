import { describe, expect, it } from "vitest";
import {
    transformBreakout,
    transformFredData,
    transformNews,
    transformTokenUnlock
} from "../../../src/class/Dashboard/panel-transforms.js";
import { PANEL_CATEGORIES, PANEL_FETCHERS, PANEL_LABEL_KEYS } from "../../../src/class/Dashboard/panel-registry.js";

describe("dashboard panel transforms", () => {
    it("localizes news titles and drops empty records", () => {
        const result = transformNews({
            status: true,
            data: [
                { title: { en: "ETF flows rise", zh: "ETF 资金流入上升" }, ts: "2026-05-01T10:00:00Z" },
                { title: "" },
                { displayTitle: "ignored without title" }
            ]
        }, "zh");

        expect(result).toHaveLength(1);
        expect(result[0].displayTitle).toBe("ETF 资金流入上升");
        expect(result[0].timestamp).toBe("2026-05-01T10:00:00Z");
    });

    it("normalizes breakout direction and display title", () => {
        const result = transformBreakout([{
            signals: [{
                title: "Breakout UP For BTCUSDT",
                direction: "bull",
                details: { Symbol: "BTCUSDT", TimeFrame: "4H", Side: "up" }
            }],
            updatedAt: "2026-05-01T11:00:00Z"
        }], "en");

        expect(result).toHaveLength(1);
        expect(result[0].direction).toBe("bull");
        expect(result[0].displayTitle).toBe("[4H] Breakout UP For BTCUSDT");
    });

    it("converts token unlock second timestamps to milliseconds", () => {
        const result = transformTokenUnlock({
            data: [
                { symbol: "SOL", perc: "2.5", unlockValue: "$10M (est)", ts: 1760000000 }
            ]
        });

        expect(result).toHaveLength(1);
        expect(result[0].displayTitle).toBe("SOL 2.5% $10M");
        expect(result[0].timestamp).toBe(1760000000000);
    });

    it("flattens FRED dashboard sections into panel rows", () => {
        const result = transformFredData({
            rates: {
                FEDFUNDS: { label: "Fed Funds", value: 4.25, unit: "%", change: -0.01, date: "2026-04-30" }
            },
            liquidity: {
                NET_LIQ: { label: "Net Liquidity", value: 6123.4, formatted: "$6.12T", date: "2026-04-30" }
            }
        });

        expect(result.map(item => item.displayTitle)).toEqual([
            "Fed Funds: 4.25% ↓",
            "Net Liquidity: $6.12T"
        ]);
    });
});

describe("dashboard panel registry", () => {
    it("keeps labels, categories, and fetchers in sync for core panels", () => {
        expect(PANEL_LABEL_KEYS.breakout).toBe("LABEL_BREAKOUT");
        expect(PANEL_CATEGORIES.breakout).toBe("breakout");
        expect(PANEL_FETCHERS.breakout.channels).toEqual(["breakout-htf", "breakout-mtf"]);
        expect(PANEL_FETCHERS.fredDashboard.type).toBe("fred");
    });
});
