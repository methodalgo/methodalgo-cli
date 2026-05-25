import { describe, expect, it } from "vitest";
import { helpExample, helpList, helpSection } from "../../src/utils/help-format.js";

describe("help-format", () => {
    it("highlights help titles, examples, and item keys", () => {
        expect(helpSection("示例", "body")).toContain("\u001b[33m示例\u001b[39m");
        expect(helpExample("methodalgo totals btc-dominance --json")).toContain("\u001b[36mmethodalgo totals btc-dominance --json\u001b[39m");
        expect(helpList([["btc-dominance", "BTC Dominance"]])).toContain("\u001b[33mbtc-dominance\u001b[39m");
    });
});
