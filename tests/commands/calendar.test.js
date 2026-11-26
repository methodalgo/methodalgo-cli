import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
        // 真实的 logger.error 会把退出码置为 1，替身需保留这一行为
        error: vi.fn(() => { process.exitCode = 1; }),
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

    afterEach(() => {
        process.exitCode = undefined;
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

    // 脚本与 LLM 代理靠退出码判断成败：缺 -c 时必须明确失败，不能以退出码 0 输出帮助冒充成功
    describe('Missing required countries', () => {
        const spies = [];
        afterEach(() => {
            spies.splice(0).forEach(spy => spy.mockRestore());
        });
        const stubExitAndHelp = () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
            spies.push(exitSpy, vi.spyOn(process.stdout, 'write').mockImplementation(() => true));
            return exitSpy;
        };

        it('should exit with a failure code without requesting or printing data', async () => {
            const { signedRequest } = await import('../../src/utils/api.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            const { default: calendarCmd } = await import('../../src/commands/calendar.js');
            const exitSpy = stubExitAndHelp();

            await calendarCmd.parseAsync(['node', 'calendar', '--json'], { from: 'node' });

            expect(exitSpy).toHaveBeenCalledWith(1);
            expect(signedRequest).not.toHaveBeenCalled();
            expect(logger.json).not.toHaveBeenCalled();
        });

        it('should explain the missing countries with a runnable suggestion', async () => {
            const { t } = await import('../../src/utils/i18n.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            const { default: calendarCmd } = await import('../../src/commands/calendar.js');
            stubExitAndHelp();

            await calendarCmd.parseAsync(['node', 'calendar'], { from: 'node' });

            expect(logger.error).toHaveBeenCalledWith(t('ERR_MISSING_COUNTRIES'), expect.stringContaining('methodalgo calendar'));
        });
    });
});
