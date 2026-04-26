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

describe('calendar Command Structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('Command structure', () => {
        it('should have correct command name', async () => {
            const { default: calendarCmd } = await import('../../src/commands/calendar.js');
            
            expect(calendarCmd.name()).toBe('calendar');
        });

        it('should have no subcommands', async () => {
            const { default: calendarCmd } = await import('../../src/commands/calendar.js');
            
            expect(calendarCmd.commands.length).toBe(0);
        });

        it('should have correct options', async () => {
            const { default: calendarCmd } = await import('../../src/commands/calendar.js');
            
            const optionNames = calendarCmd.options.map(o => o.attributeName());
            
            expect(optionNames).toContain('countries');
            expect(optionNames).toContain('from');
            expect(optionNames).toContain('to');
            expect(optionNames).toContain('json');
        });
    });
});
