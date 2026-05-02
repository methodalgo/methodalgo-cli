import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/utils/logger.js", () => ({
    default: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        json: vi.fn()
    }
}));

vi.mock("../../src/utils/price-utils.js", async () => {
    const actual = await vi.importActual("../../src/utils/price-utils.js");
    return {
        ...actual,
        fetchBinanceMovers: vi.fn()
    };
});

const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

describe("binance Command Structure", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it("has the expected command name and subcommands", async () => {
        const { default: binanceCmd } = await import("../../src/commands/binance.js");
        const subcommandNames = binanceCmd.commands.map(c => c.name());

        expect(binanceCmd.name()).toBe("binance");
        expect(subcommandNames).toContain("price");
        expect(subcommandNames).toContain("ticker");
        expect(subcommandNames).toContain("movers");
        expect(subcommandNames).toContain("book");
        expect(subcommandNames).toContain("trades");
        expect(subcommandNames).toContain("klines");
        expect(subcommandNames).toContain("funding");
        expect(subcommandNames).toContain("oi");
        expect(subcommandNames).toContain("sentiment");
        expect(subcommandNames).toContain("basis");
        expect(subcommandNames).toContain("exchange-info");
        expect(subcommandNames).toContain("raw");
    });

    it("sets auto as the default market for symbol-scoped dual-market commands", async () => {
        const { default: binanceCmd } = await import("../../src/commands/binance.js");
        const priceCmd = binanceCmd.commands.find(c => c.name() === "price");
        const marketOption = priceCmd.options.find(o => o.attributeName() === "market");

        expect(marketOption.defaultValue).toBe("auto");
    });

    it("keeps futures basis command available for Binance futuresPrice responses", async () => {
        const { default: binanceCmd } = await import("../../src/commands/binance.js");
        const basisCmd = binanceCmd.commands.find(c => c.name() === "basis");

        expect(basisCmd).toBeDefined();
        expect(basisCmd.options.map(o => o.attributeName())).toContain("period");
    });
});
