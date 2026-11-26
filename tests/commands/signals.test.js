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

describe('signals Command Structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    afterEach(() => {
        process.exitCode = undefined;
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

    // 脚本与 LLM 代理靠退出码判断成败：缺 channel 时必须明确失败，不能以退出码 0 输出帮助冒充成功
    describe('Missing required channel', () => {
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
            const { default: signalsCmd } = await import('../../src/commands/signals.js');
            const exitSpy = stubExitAndHelp();

            await signalsCmd.parseAsync(['node', 'signals', '--limit', '2', '--json'], { from: 'node' });

            expect(exitSpy).toHaveBeenCalledWith(1);
            expect(signedRequest).not.toHaveBeenCalled();
            expect(logger.json).not.toHaveBeenCalled();
        });

        it('should explain the missing channel with a runnable suggestion', async () => {
            const { t } = await import('../../src/utils/i18n.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            const { default: signalsCmd } = await import('../../src/commands/signals.js');
            const exitSpy = stubExitAndHelp();

            await signalsCmd.parseAsync(['node', 'signals'], { from: 'node' });

            expect(logger.error).toHaveBeenCalledWith(t('ERR_MISSING_CHANNEL'), expect.stringContaining('methodalgo signals breakout-mtf'));
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('Fetching signals', () => {
        it('should still fetch and print data once a channel is given', async () => {
            const { signedRequest } = await import('../../src/utils/api.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            signedRequest.mockResolvedValue({ data: { status: true, data: [{ id: '1' }] } });
            const { default: signalsCmd } = await import('../../src/commands/signals.js');

            await signalsCmd.parseAsync(['node', 'signals', 'breakout-mtf', '--limit', '2', '--json'], { from: 'node' });

            expect(signedRequest).toHaveBeenCalledWith('/cli/signals', expect.objectContaining({ channelName: 'breakout-mtf', limit: '2' }));
            expect(logger.json).toHaveBeenCalledWith([{ id: '1' }]);
        });

        it('should render signal titles for a regular channel in human-readable mode', async () => {
            const { signedRequest } = await import('../../src/utils/api.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            signedRequest.mockResolvedValue({ data: { status: true, data: [{
                timestamp: 1795716298155,
                signals: [{ title: 'Breakout For **GLMUSDT.P**', description: 'desc', direction: 'bull', details: { Entry: '1.0' } }]
            }] } });
            const { default: signalsCmd } = await import('../../src/commands/signals.js');

            await signalsCmd.parseAsync(['node', 'signals', 'breakout-mtf', '--limit', '1'], { from: 'node' });

            expect(logger.success).toHaveBeenCalledTimes(1);
            expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Breakout For **GLMUSDT.P**'));
        });

        it('should render token unlock details for the token-unlock channel', async () => {
            const { signedRequest } = await import('../../src/utils/api.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            signedRequest.mockResolvedValue({ data: { status: true, data: {
                updatedAt: Date.now(),
                signals: [{ symbol: 'GRASS', perc: 10, ts: Date.now() + 86400000, progress: '25%', unlockToken: '1M', unlockTokenVal: '2M USD (1%)' }]
            } } });
            const { default: signalsCmd } = await import('../../src/commands/signals.js');

            await signalsCmd.parseAsync(['node', 'signals', 'token-unlock', '--limit', '1'], { from: 'node' });

            expect(logger.success).toHaveBeenCalledTimes(1);
            expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('GRASS'));
        });

        it('should report an API failure instead of printing data', async () => {
            const { signedRequest } = await import('../../src/utils/api.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            signedRequest.mockResolvedValue({ data: { status: false, message: 'boom' } });
            const { default: signalsCmd } = await import('../../src/commands/signals.js');

            await signalsCmd.parseAsync(['node', 'signals', 'breakout-mtf', '--json'], { from: 'node' });

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
            expect(logger.json).not.toHaveBeenCalled();
        });

        it('should report a thrown request error instead of crashing', async () => {
            const { signedRequest } = await import('../../src/utils/api.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            signedRequest.mockRejectedValue(new Error('socket hang up'));
            const { default: signalsCmd } = await import('../../src/commands/signals.js');

            await signalsCmd.parseAsync(['node', 'signals', 'breakout-mtf', '--json'], { from: 'node' });

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('socket hang up'));
            expect(logger.json).not.toHaveBeenCalled();
        });
    });
});
