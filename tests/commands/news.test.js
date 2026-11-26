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

    // 脚本与 LLM 代理靠退出码判断成败：缺 --type 时必须明确失败，不能以退出码 0 输出帮助冒充成功
    describe('Missing required --type', () => {
        const spies = [];
        afterEach(() => {
            process.exitCode = undefined;
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
            const { default: newsCmd } = await import('../../src/commands/news.js');
            const exitSpy = stubExitAndHelp();

            await newsCmd.parseAsync(['node', 'news', '--limit', '2', '--json'], { from: 'node' });

            expect(exitSpy).toHaveBeenCalledWith(1);
            expect(signedRequest).not.toHaveBeenCalled();
            expect(logger.json).not.toHaveBeenCalled();
        });

        it('should explain the missing type with a runnable suggestion', async () => {
            const { t } = await import('../../src/utils/i18n.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            const { default: newsCmd } = await import('../../src/commands/news.js');
            const exitSpy = stubExitAndHelp();

            await newsCmd.parseAsync(['node', 'news'], { from: 'node' });

            expect(logger.error).toHaveBeenCalledWith(t('ERR_MISSING_TYPE'), expect.stringContaining('methodalgo news --type'));
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('Fetching news', () => {
        it('should still fetch and print data once --type is given', async () => {
            const { signedRequest } = await import('../../src/utils/api.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            signedRequest.mockResolvedValue({ data: { status: true, data: [{ title: 'Test' }] } });
            const { default: newsCmd } = await import('../../src/commands/news.js');

            await newsCmd.parseAsync(['node', 'news', '--type', 'breaking', '--limit', '1', '--json'], { from: 'node' });

            expect(signedRequest).toHaveBeenCalledWith('/cli/news', expect.objectContaining({ type: 'breaking', limit: '1' }));
            expect(logger.json).toHaveBeenCalledWith([{ title: 'Test' }]);
        });

        it('should render title and link for each item in human-readable mode', async () => {
            const { signedRequest } = await import('../../src/utils/api.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            signedRequest.mockResolvedValue({ data: { status: true, data: [{
                title: { zh: '测试标题', en: 'Test title' },
                excerpt: { zh: '测试摘要', en: 'Excerpt text' },
                url: 'https://www.example.com/post/1',
                publish_date: '2026-11-27T00:00:00Z'
            }] } });
            const { default: newsCmd } = await import('../../src/commands/news.js');

            await newsCmd.parseAsync(['node', 'news', '--type', 'breaking', '--limit', '1'], { from: 'node' });

            expect(logger.success).toHaveBeenCalledTimes(1);
            expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test title'));
            expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Excerpt text...'));
            expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('https://www.example.com/post/1'));
        });

        it('should report an API failure instead of printing data', async () => {
            const { signedRequest } = await import('../../src/utils/api.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            signedRequest.mockResolvedValue({ data: { status: false, message: 'boom' } });
            const { default: newsCmd } = await import('../../src/commands/news.js');

            await newsCmd.parseAsync(['node', 'news', '--type', 'breaking', '--json'], { from: 'node' });

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
            expect(logger.json).not.toHaveBeenCalled();
        });

        it('should report a thrown request error instead of crashing', async () => {
            const { signedRequest } = await import('../../src/utils/api.js');
            const logger = (await import('../../src/utils/logger.js')).default;
            signedRequest.mockRejectedValue(new Error('socket hang up'));
            const { default: newsCmd } = await import('../../src/commands/news.js');

            await newsCmd.parseAsync(['node', 'news', '--type', 'breaking', '--json'], { from: 'node' });

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('socket hang up'));
            expect(logger.json).not.toHaveBeenCalled();
        });
    });
});
