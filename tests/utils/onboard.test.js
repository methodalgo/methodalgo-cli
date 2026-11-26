import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAnswers = vi.hoisted(() => []);
const mockInput = vi.hoisted(() => ({ noAnswer: false, closeHandlers: [] }));
const mockConfigSet = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockLoginWithOAuth = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    json: vi.fn()
}));

vi.mock("readline", () => {
    // 模拟输入已结束时 readline 的行为：不再回调 question，只触发 close 事件
    const createInterface = () => ({
        question: vi.fn((query, callback) => {
            if (!mockInput.noAnswer) callback(mockAnswers.shift() ?? "");
        }),
        close: vi.fn(),
        on: vi.fn((event, handler) => {
            if (event === "close") mockInput.closeHandlers.push(handler);
        }),
        once: vi.fn((event, handler) => {
            if (event === "close") mockInput.closeHandlers.push(handler);
        }),
        removeListener: vi.fn((event, handler) => {
            const index = mockInput.closeHandlers.indexOf(handler);
            if (index >= 0) mockInput.closeHandlers.splice(index, 1);
        })
    });
    return { default: { createInterface: vi.fn(createInterface) }, createInterface: vi.fn(createInterface) };
});

vi.mock("../../src/utils/config-manager.js", () => ({
    default: {
        get: vi.fn((key) => (key === "lang" ? "en" : "")),
        set: mockConfigSet
    }
}));

vi.mock("../../src/utils/api.js", () => ({
    validateApiKey: mockValidateApiKey
}));

vi.mock("../../src/utils/oauth-login.js", () => ({
    loginWithOAuth: mockLoginWithOAuth
}));

vi.mock("../../src/utils/logger.js", () => ({
    default: mockLogger
}));

// 引导流程只接受交互式终端；测试进程的标准输入不是终端，这里统一伪装成终端
const stdinIsTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

beforeEach(() => {
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
});

afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", { ...stdinIsTTY, configurable: true });
});

describe("startOnboarding OAuth flow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAnswers.splice(0, mockAnswers.length);
        vi.spyOn(console, "clear").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("saves the OAuth API key without calling the consuming API validator", async () => {
        expect.assertions(5);
        mockAnswers.push("1", "", "");
        mockLoginWithOAuth.mockResolvedValueOnce({
            apiKey: "ma_oauth_key",
            user: { email: "user@example.com" }
        });

        const { startOnboarding } = await import("../../src/utils/onboard.js");
        await startOnboarding("");

        expect(mockLoginWithOAuth).toHaveBeenCalledTimes(1);
        expect(mockValidateApiKey).not.toHaveBeenCalled();
        expect(mockConfigSet).toHaveBeenCalledWith("apiKey", "ma_oauth_key");
        expect(mockConfigSet).toHaveBeenCalledWith("lang", "en");
        expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("account/api-keys"));
    });

    it("shows the API key link only after choosing manual API key login", async () => {
        expect.assertions(3);
        mockAnswers.push("2", "2", "ma_manual_key", "");
        mockValidateApiKey.mockResolvedValueOnce(true);

        const { startOnboarding } = await import("../../src/utils/onboard.js");
        await startOnboarding("");

        expect(mockLoginWithOAuth).not.toHaveBeenCalled();
        expect(mockConfigSet).toHaveBeenCalledWith("apiKey", "ma_manual_key");
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("account/api-keys"));
    });

    describe("completion", () => {
        beforeEach(() => {
            mockInput.noAnswer = false;
            mockInput.closeHandlers.splice(0, mockInput.closeHandlers.length);
        });

        it("reports success once a key is saved", async () => {
            mockAnswers.push("1", "", "");
            mockLoginWithOAuth.mockResolvedValueOnce({ apiKey: "test-auth-token" });

            const { startOnboarding } = await import("../../src/utils/onboard.js");

            expect(await startOnboarding("")).toBe(true);
        });

        // 没有密钥的代理或脚本运行命令时没有交互输入：必须明确失败并以非零退出码结束，不能一直等待或静默退出
        it("fails clearly instead of hanging when standard input is closed", async () => {
            mockInput.noAnswer = true;
            const { startOnboarding } = await import("../../src/utils/onboard.js");

            const pending = startOnboarding("");
            await new Promise((resolve) => setImmediate(resolve));
            mockInput.closeHandlers.splice(0).forEach((handler) => handler());

            expect(await pending).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error.mock.calls[0][1]).toContain("methodalgo login");
            expect(mockConfigSet).not.toHaveBeenCalled();
        });

        // 代理、CI、容器等环境的标准输入不是终端：必须立即明确失败，不能一直等待输入
        it("fails clearly without waiting when standard input is not a terminal", async () => {
            mockInput.noAnswer = true;
            Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
            const readline = await import("readline");
            const { startOnboarding } = await import("../../src/utils/onboard.js");

            expect(await startOnboarding("")).toBe(false);
            expect(readline.default.createInterface).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockConfigSet).not.toHaveBeenCalled();
        });
    });
});
