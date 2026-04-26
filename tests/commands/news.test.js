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

describe('news Command Structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('Command structure', () => {
        it('should have correct command name', async () => {
            const { default: newsCmd } = await import('../../src/commands/news.js');
            
            expect(newsCmd.name()).toBe('news');
        });

        it('should have no subcommands', async () => {
            const { default: newsCmd } = await import('../../src/commands/news.js');
            
            expect(newsCmd.commands.length).toBe(0);
        });

        it('should have correct options', async () => {
            const { default: newsCmd } = await import('../../src/commands/news.js');
            
            const optionNames = newsCmd.options.map(o => o.attributeName());
            
            expect(optionNames).toContain('type');
            expect(optionNames).toContain('limit');
            expect(optionNames).toContain('language');
            expect(optionNames).toContain('search');
            expect(optionNames).toContain('startDate');
            expect(optionNames).toContain('endDate');
            expect(optionNames).toContain('json');
        });

        it('should have default values for options', async () => {
            const { default: newsCmd } = await import('../../src/commands/news.js');
            
            const limitOption = newsCmd.options.find(o => o.attributeName() === 'limit');
            const langOption = newsCmd.options.find(o => o.attributeName() === 'language');
            
            expect(limitOption.defaultValue).toBe('10');
            expect(langOption.defaultValue).toBe('zh');
        });
    });
});
