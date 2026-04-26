import { describe, it, expect, vi, beforeEach } from 'vitest';
import config from '../../src/utils/config-manager.js';
import logger from '../../src/utils/logger.js';

vi.mock('../../src/utils/config-manager.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
    }
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

vi.mock('readline', () => ({
    default: {
        createInterface: vi.fn(() => ({
            question: vi.fn((query, callback) => {
                callback('y');
            }),
            close: vi.fn()
        }))
    }
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('login Command Structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        delete process.env.METHODALGO_API_KEY;
    });

    describe('Command structure', () => {
        it('should have correct command name', async () => {
            const { default: loginCmd } = await import('../../src/commands/login.js');
            
            expect(loginCmd.name()).toBe('login');
        });

        it('should have no subcommands', async () => {
            const { default: loginCmd } = await import('../../src/commands/login.js');
            
            expect(loginCmd.commands.length).toBe(0);
        });
    });
});
