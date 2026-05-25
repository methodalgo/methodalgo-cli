import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/utils/api.js", () => ({
    signedRequest: vi.fn()
}));

vi.mock("../../src/utils/logger.js", () => ({
    default: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        json: vi.fn()
    }
}));

vi.spyOn(console, "log").mockImplementation(() => {});

describe("totals Command", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it("has the expected command name and metric subcommands", async () => {
        const { default: totalsCmd } = await import("../../src/commands/totals.js");
        const subcommandNames = totalsCmd.commands.map(c => c.name());

        expect(totalsCmd.name()).toBe("totals");
        expect(subcommandNames).toEqual(expect.arrayContaining([
            "btc-dominance",
            "eth-dominance",
            "total-market-cap",
            "fear-greed",
            "altseason-index"
        ]));
    });

    it("shows help for the parent command without querying data", async () => {
        const { signedRequest } = await import("../../src/utils/api.js");
        const { default: totalsCmd } = await import("../../src/commands/totals.js");
        totalsCmd.help = vi.fn();

        await totalsCmd.parseAsync(["node", "totals"], { from: "node" });

        expect(totalsCmd.help).toHaveBeenCalledTimes(1);
        expect(signedRequest).not.toHaveBeenCalled();
    });

    it("routes aggregate totals through market-environment", async () => {
        const { signedRequest } = await import("../../src/utils/api.js");
        const logger = (await import("../../src/utils/logger.js")).default;
        signedRequest.mockResolvedValue({
            data: {
                status: true,
                data: {
                    convert: "USD",
                    source: "coinmarketcap",
                    btcDominance: 54.2,
                    ethDominance: 12.4,
                    totalMarketCap: 3200000000000,
                    fearAndGreed: { value: 68, classification: "Greed" },
                    altcoinSeason: { value: 42 }
                }
            }
        });
        const { default: totalsCmd } = await import("../../src/commands/totals.js");

        await totalsCmd.parseAsync(["node", "totals", "--json"], { from: "node" });

        expect(signedRequest).toHaveBeenCalledWith("/cli/macro", {
            type: "market-environment",
            convert: "USD"
        });
        expect(logger.json).toHaveBeenCalledWith(expect.objectContaining({
            command: "totals",
            metrics: expect.objectContaining({
                btcDominance: expect.objectContaining({ value: 54.2 }),
                fearAndGreed: expect.objectContaining({ value: 68 }),
                altcoinSeason: expect.objectContaining({ value: 42 })
            })
        }));
    });

    it("treats parent --convert as an explicit aggregate query", async () => {
        const { signedRequest } = await import("../../src/utils/api.js");
        signedRequest.mockResolvedValue({
            data: {
                status: true,
                data: {
                    convert: "EUR",
                    source: "coinmarketcap",
                    btcDominance: 54.2,
                    ethDominance: 12.4,
                    totalMarketCap: 3000000000000,
                    fearAndGreed: { value: 68, classification: "Greed" },
                    altcoinSeason: { value: 42 }
                }
            }
        });
        const { default: totalsCmd } = await import("../../src/commands/totals.js");
        totalsCmd.help = vi.fn();

        await totalsCmd.parseAsync(["node", "totals", "--convert", "EUR"], { from: "node" });

        expect(totalsCmd.help).not.toHaveBeenCalled();
        expect(signedRequest).toHaveBeenCalledWith("/cli/macro", {
            type: "market-environment",
            convert: "EUR"
        });
    });

    it("handles aggregate request failures without showing help or throwing", async () => {
        const { signedRequest } = await import("../../src/utils/api.js");
        const logger = (await import("../../src/utils/logger.js")).default;
        signedRequest.mockRejectedValue(new Error("Request failed with status 404"));
        const { default: totalsCmd } = await import("../../src/commands/totals.js");
        totalsCmd.helpInformation = vi.fn(() => "help");

        await expect(totalsCmd.parseAsync(["node", "totals", "--json"], { from: "node" })).resolves.toBe(totalsCmd);

        expect(signedRequest).toHaveBeenCalledWith("/cli/macro", {
            type: "market-environment",
            convert: "USD"
        });
        expect(totalsCmd.helpInformation).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Request failed with status 404"));
    });

    it("maps totals metric history to market-history", async () => {
        const { signedRequest } = await import("../../src/utils/api.js");
        const logger = (await import("../../src/utils/logger.js")).default;
        signedRequest
            .mockResolvedValueOnce({
                data: {
                    status: true,
                    data: { convert: "USD", source: "coinmarketcap", btcDominance: 54.2 }
                }
            })
            .mockResolvedValueOnce({
                data: {
                    status: true,
                    data: { metric: "btcDominance", timeframe: "90d", points: [{ time: "2026-05-25", value: 54.2 }] }
                }
            });
        const { default: totalsCmd } = await import("../../src/commands/totals.js");
        const btcDominanceCmd = totalsCmd.commands.find(c => c.name() === "btc-dominance");

        await btcDominanceCmd.parseAsync(["--history", "90d", "--json"], { from: "user" });

        expect(signedRequest).toHaveBeenNthCalledWith(1, "/cli/macro", {
            type: "market-environment",
            convert: "USD"
        });
        expect(signedRequest).toHaveBeenNthCalledWith(2, "/cli/macro", {
            type: "market-history",
            metric: "btcDominance",
            timeframe: "90d",
            convert: "USD"
        });
        expect(logger.json).toHaveBeenCalledWith(expect.objectContaining({
            command: "totals btc-dominance",
            metric: "btcDominance",
            history: expect.objectContaining({ timeframe: "90d" })
        }));
    });
});
