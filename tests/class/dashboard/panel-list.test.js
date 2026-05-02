import { describe, expect, it } from "vitest";
import {
    getDashboardItemKey,
    findDashboardItemIndex,
    getWatchlistMatches
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
});
