import { describe, expect, it } from "vitest";
import { buildDetailModel, parseDetailText } from "../../../src/class/Dashboard/DetailDialog.js";

describe("dashboard detail model", () => {
    it("builds a news detail card with localized analysis and resource links", () => {
        const model = buildDetailModel({
            type: "breaking",
            category: "Breaking",
            lang: "zh",
            data: {
                title: { en: "ETF decision", zh: "ETF 决议" },
                displayTitle: "ETF 决议",
                analysis: { zh: "资金流可能扩大", en: "Flows may expand" },
                excerpt: { zh: "监管批准新的 ETF。", en: "Regulator approved a new ETF." },
                publish_date: "2026-05-03T00:00:00Z",
                url: "https://example.com/news",
                imageUrl: "https://example.com/image.png"
            }
        });

        expect(model.title).toBe("ETF 决议");
        expect(model.badges).toEqual(["BREAKING"]);
        expect(model.meta.some(item => item.labelKey === "TUI_DETAIL_TIME")).toBe(true);
        expect(model.sections).toEqual([
            { titleKey: "TUI_DETAIL_ANALYSIS", lines: ["资金流可能扩大"] },
            { titleKey: "TUI_DETAIL_SUMMARY", lines: ["监管批准新的 ETF。"] },
            { titleKey: "TUI_DETAIL_RESOURCES", lines: ["URL: https://example.com/news", "Image: https://example.com/image.png"] }
        ]);
    });

    it("builds a signal detail card with symbol, direction and details", () => {
        const model = buildDetailModel({
            type: "breakout",
            category: "Breakout",
            lang: "en",
            data: {
                direction: "bull",
                displayTitle: "[4H] Breakout UP For BTCUSDT",
                timestamp: "2026-05-03T00:00:00Z",
                signals: [{
                    title: "Breakout UP For BTCUSDT",
                    description: "TimeFrame: 4H",
                    details: { Symbol: "BTCUSDT", TimeFrame: "4H", Side: "up" }
                }]
            }
        });

        expect(model.badges).toEqual(["BREAKOUT", "BTCUSDT", "BULL", "4H"]);
        expect(model.sections[0]).toEqual({
            titleKey: "TUI_DETAIL_SIGNAL_DETAILS",
            lines: ["Symbol: BTCUSDT", "TimeFrame: 4H", "Side: up"]
        });
        expect(model.sections[1]).toEqual({
            titleKey: "TUI_DETAIL_SUMMARY",
            lines: ["TimeFrame: 4H"]
        });
    });

    it("builds a token unlock detail card with structured metrics", () => {
        const model = buildDetailModel({
            type: "tokenUnlock",
            category: "Token Unlock",
            lang: "en",
            data: {
                symbol: "SOL",
                perc: "2.5",
                unlockValue: "$10M",
                marketCap: "$2B",
                progress: "80%",
                countDown: "2d",
                timestamp: "2026-05-03T00:00:00Z"
            }
        });

        expect(model.badges).toEqual(["TOKEN UNLOCK", "SOL"]);
        expect(model.sections[0]).toEqual({
            titleKey: "TUI_DETAIL_KEY_METRICS",
            lines: [
                "Symbol: SOL",
                "Market Cap: $2B",
                "Progress: 80%",
                "Countdown: 2d",
                "Quantity: $10M",
                "Percentage: 2.5%"
            ]
        });
    });

    it("parses nested localized text without object dumps", () => {
        expect(parseDetailText({ zh: { text: "中文" }, en: "English" }, "zh")).toBe("中文");
        expect(parseDetailText([{ en: "A" }, { en: "B" }], "en")).toBe("A\nB");
    });
});
