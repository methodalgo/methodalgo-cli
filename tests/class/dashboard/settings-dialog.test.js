import { describe, expect, it } from "vitest";
import { getNextPanelOrder } from "../../../src/class/Dashboard/SettingsDialog.js";

describe("SettingsDialog helpers", () => {
    it("calculates the next order when moving a panel into a column", () => {
        expect(getNextPanelOrder({
            article: { column: 1, order: 1 },
            breaking: { column: 1, order: 4 },
            breakout: { column: 2, order: 1 }
        }, 1)).toBe(5);

        expect(getNextPanelOrder({
            article: { column: 1, order: 1 }
        }, 3)).toBe(1);
    });
});
