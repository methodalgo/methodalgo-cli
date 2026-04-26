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

vi.mock('child_process', () => ({
    exec: vi.fn()
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('update Command Structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('Command structure', () => {
        it('should have correct command name', async () => {
            const { default: updateCmd } = await import('../../src/commands/update.js');
            
            expect(updateCmd.name()).toBe('update');
        });

        it('should have no subcommands', async () => {
            const { default: updateCmd } = await import('../../src/commands/update.js');
            
            expect(updateCmd.commands.length).toBe(0);
        });
    });
});
