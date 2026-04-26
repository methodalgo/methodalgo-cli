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
        json: vi.fn()
    }
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('signals Command Structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('Command structure', () => {
        it('should have correct command name', async () => {
            const { default: signalsCmd } = await import('../../src/commands/signals.js');
            
            expect(signalsCmd.name()).toBe('signals');
        });

        it('should have no subcommands', async () => {
            const { default: signalsCmd } = await import('../../src/commands/signals.js');
            
            expect(signalsCmd.commands.length).toBe(0);
        });

        it('should have correct options', async () => {
            const { default: signalsCmd } = await import('../../src/commands/signals.js');
            
            const optionNames = signalsCmd.options.map(o => o.attributeName());
            
            expect(optionNames).toContain('limit');
            expect(optionNames).toContain('after');
            expect(optionNames).toContain('json');
        });

        it('should have default limit value', async () => {
            const { default: signalsCmd } = await import('../../src/commands/signals.js');
            
            const limitOption = signalsCmd.options.find(o => o.attributeName() === 'limit');
            expect(limitOption.defaultValue).toBe('10');
        });
    });
});
