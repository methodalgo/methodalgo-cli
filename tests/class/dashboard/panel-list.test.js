import { describe, expect, it } from "vitest";
import {
    getDashboardItemKey,
    findDashboardItemIndex,
    getWatchlistMatches,
    getNewEventLabel,
    hasRecentDashboardItems,
    getDashboardItemTitle,
    getRenderableDashboardItems,
    getDashboardItemTimePrefix
} from "../../../src/class/Dashboard/PanelList.js";

describe("PanelList helpers", () => {
    it("keeps selection anchored to the same item when new items arrive above it", () => {
        const oldItems = [
            { id: "old-1", displayTitle: "BTC first" },
            { id: "old-2", displayTitle: "ETH selected" }
        ];
        const selectedKey = getDashboardItemKey(oldItems[1]);
        const newItems = [
            { id: "new-1", displayTitle: "SOL new" },
            ...oldItems
        ];

        expect(findDashboardItemIndex(newItems, selectedKey)).toBe(2);
    });

    it("matches watchlist symbols from titles and signal details", () => {
        const item = {
            displayTitle: "[1H] Breakout UP For SOLUSDT",
            signals: [{ details: { Symbol: "BTCUSDT" } }]
        };

        expect(getWatchlistMatches(item, ["sol", "eth"])).toEqual(["SOL"]);
        expect(getWatchlistMatches(item, ["btc"])).toEqual(["BTC"]);
    });

    it("labels recent dashboard items with a NEW age", () => {
        const now = Date.parse("2026-05-03T00:00:12Z");
        const item = { timestamp: "2026-05-03T00:00:00Z" };

        expect(getNewEventLabel(item, now)).toBe("[NEW 12s]");
        expect(getNewEventLabel(item, now + 61000)).toBe("");
    });

    it("detects whether any visible item still needs NEW ticking", () => {
        const now = Date.parse("2026-05-03T00:00:12Z");
        expect(hasRecentDashboardItems([{ timestamp: "2026-05-03T00:00:00Z" }], now)).toBe(true);
        expect(hasRecentDashboardItems([{ timestamp: "2026-05-02T23:58:00Z" }], now)).toBe(false);
    });

    it("can hide time prefixes for realtime ranking rows", () => {
        expect(getDashboardItemTimePrefix({ hideTime: true, timestamp: "2026-05-03T00:00:00Z" })).toBe("");
        expect(getDashboardItemTimePrefix({ timestamp: "2026-05-03T00:00:00Z" })).toMatch(/^\[\d{2}:\d{2}\] $/);
    });

    it("filters unrenderable items before panel pagination", () => {
        const items = [
            { id: "a", displayTitle: "Visible title" },
            { id: "b", displayTitle: "" },
            null,
            { id: "c", title: "Fallback title" },
            { id: "d", signals: [{ title: "Signal title" }] }
        ];

        expect(getDashboardItemTitle(items[3])).toBe("Fallback title");
        expect(getRenderableDashboardItems(items)).toEqual([
            { item: items[0], originalIndex: 0, title: "Visible title" },
            { item: items[3], originalIndex: 3, title: "Fallback title" },
            { item: items[4], originalIndex: 4, title: "Signal title" }
        ]);
    });
});
