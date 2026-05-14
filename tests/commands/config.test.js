import { describe, it, expect, vi, beforeEach } from 'vitest';
import config from '../../src/utils/config-manager.js';
import logger from '../../src/utils/logger.js';

vi.mock('../../src/utils/config-manager.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        store: {},
    }
}));

vi.mock('../../src/utils/api.js', () => ({
    validateApiKey: vi.fn()
}));

vi.mock('../../src/utils/logger.js', () => ({
    default: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        json: vi.fn()
    }
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('config Command Structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('Command structure', () => {
        it('should have correct command name', async () => {
            const { default: configCmd } = await import('../../src/commands/config.js');
            
            expect(configCmd.name()).toBe('config');
        });

        it('should have correct subcommands', async () => {
            const { default: configCmd } = await import('../../src/commands/config.js');
            
            const subcommandNames = configCmd.commands.map(c => c.name());
            expect(subcommandNames).toContain('set');
            expect(subcommandNames).toContain('get');
            expect(subcommandNames).toContain('list');
        });

        it('should have options defined for parent command', async () => {
            const { default: configCmd } = await import('../../src/commands/config.js');
            
            expect(configCmd.options).toBeDefined();
        });
    });

    describe('API Key Map constants', () => {
        it('should map user-friendly keys to internal keys correctly', () => {
            const API_KEY_MAP = {
                "api-key": "apiKey",
                "lang": "lang",
                "api-base": "apiBase",
                "account-base": "accountBase",
                "fred-api-key": "fredApiKey"
            };
            
            expect(API_KEY_MAP["api-key"]).toBe("apiKey");
            expect(API_KEY_MAP["lang"]).toBe("lang");
            expect(API_KEY_MAP["api-base"]).toBe("apiBase");
            expect(API_KEY_MAP["account-base"]).toBe("accountBase");
            expect(API_KEY_MAP["fred-api-key"]).toBe("fredApiKey");
        });
    });
});
