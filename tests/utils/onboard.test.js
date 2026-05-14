import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAnswers = vi.hoisted(() => []);
const mockConfigSet = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockLoginWithOAuth = vi.hoisted(() => vi.fn());

vi.mock("readline", () => ({
    default: {
        createInterface: vi.fn(() => ({
            question: vi.fn((query, callback) => {
                callback(mockAnswers.shift() ?? "");
            }),
            close: vi.fn()
        }))
    },
    createInterface: vi.fn(() => ({
        question: vi.fn((query, callback) => {
            callback(mockAnswers.shift() ?? "");
        }),
        close: vi.fn()
    }))
}));

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
});
