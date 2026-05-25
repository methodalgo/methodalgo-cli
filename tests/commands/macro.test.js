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

const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

describe("macro Command Structure", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it("has the expected command name and subcommands", async () => {
        const { default: macroCmd } = await import("../../src/commands/macro.js");
        const subcommandNames = macroCmd.commands.map(c => c.name());

        expect(macroCmd.name()).toBe("macro");
        [
            "environment",
            "history",
            "snapshot",
            "series",
            "calendar",
            "search",
            "get",
            "info",
            "latest",
            "compare",
            "changes",
            "spread",
            "liquidity",
            "zscore",
            "dashboard",
            "recession"
        ].forEach(name => expect(subcommandNames).toContain(name));
        expect(subcommandNames).not.toContain("totals");
    });

    it("keeps CLI requests routed through /cli/macro", async () => {
        const { signedRequest } = await import("../../src/utils/api.js");
        const logger = (await import("../../src/utils/logger.js")).default;
        signedRequest.mockResolvedValue({ data: { status: true, data: { convert: "USD" } } });
        const { default: macroCmd } = await import("../../src/commands/macro.js");

        await macroCmd.parseAsync(["node", "macro", "environment", "--convert", "USD", "--json"], { from: "node" });

        expect(signedRequest).toHaveBeenCalledWith("/cli/macro", {
            type: "market-environment",
            convert: "USD"
        });
        expect(logger.json).toHaveBeenCalledWith({ convert: "USD" });
    });

    it("routes FRED replacement commands through macro endpoint", async () => {
        const { signedRequest } = await import("../../src/utils/api.js");
        const logger = (await import("../../src/utils/logger.js")).default;
        signedRequest.mockResolvedValue({ data: { status: true, data: { command: "liquidity" } } });
        const { default: macroCmd } = await import("../../src/commands/macro.js");

        await macroCmd.parseAsync(["node", "macro", "liquidity", "--tail", "6", "--json"], { from: "node" });

        expect(signedRequest).toHaveBeenCalledWith("/cli/macro", {
            type: "fred-liquidity",
            tail: "6",
            includeM2: undefined
        });
        expect(logger.json).toHaveBeenCalledWith({ command: "liquidity" });
    });

    it("reports macro request failures without throwing", async () => {
        const { signedRequest } = await import("../../src/utils/api.js");
        const logger = (await import("../../src/utils/logger.js")).default;
        signedRequest.mockRejectedValue(new Error("fetch failed"));
        const { default: macroCmd } = await import("../../src/commands/macro.js");

        await expect(macroCmd.parseAsync(["node", "macro", "environment", "--json"], { from: "node" })).resolves.toBeDefined();

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("fetch failed"));
    });

});
