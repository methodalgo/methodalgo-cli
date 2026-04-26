import { describe, it, expect, vi, beforeEach } from 'vitest';
import config from '../../src/utils/config-manager.js';
import logger from '../../src/utils/logger.js';

vi.mock('../../src/utils/config-manager.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
    }
}));

vi.mock('../../src/utils/api.js', () => ({
    signedRequest: vi.fn()
}));

vi.mock('../../src/utils/logger.js', () => ({
    default: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        json: vi.fn(),
        isIterm2: false,
        image: vi.fn()
    }
}));

vi.mock('axios', () => ({
    default: vi.fn()
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('snapshot Command Structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('Command structure', () => {
        it('should have correct command name', async () => {
            const { default: snapshotCmd } = await import('../../src/commands/snapshot.js');
            
            expect(snapshotCmd.name()).toBe('snapshot');
        });

        it('should have no subcommands', async () => {
            const { default: snapshotCmd } = await import('../../src/commands/snapshot.js');
            
            expect(snapshotCmd.commands.length).toBe(0);
        });

        it('should have correct options', async () => {
            const { default: snapshotCmd } = await import('../../src/commands/snapshot.js');
            
            const optionNames = snapshotCmd.options.map(o => o.attributeName());
            
            expect(optionNames).toContain('json');
            expect(optionNames).toContain('url');
            expect(optionNames).toContain('buffer');
        });
    });
});
