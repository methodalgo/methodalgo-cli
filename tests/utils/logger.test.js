import { describe, it, expect, vi, beforeEach } from 'vitest';
import { t } from '../../src/utils/i18n.js';

vi.mock('../../src/utils/i18n.js', () => ({
    t: vi.fn((key) => key)
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockProcessStdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

describe('logger Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        delete process.env.TERM_PROGRAM;
        delete process.env.ITERM_SESSION_ID;
    });

    describe('Logger methods', () => {
        it('should have info method that logs to console', async () => {
            const { default: logger } = await import('../../src/utils/logger.js');
            
            logger.info('test message');
            
            expect(mockConsoleLog).toHaveBeenCalled();
        });

        it('should have success method that logs to console', async () => {
            const { default: logger } = await import('../../src/utils/logger.js');
            
            logger.success('success message');
            
            expect(mockConsoleLog).toHaveBeenCalled();
        });

        it('should have warn method that logs to console', async () => {
            const { default: logger } = await import('../../src/utils/logger.js');
            
            logger.warn('warning message');
            
            expect(mockConsoleLog).toHaveBeenCalled();
        });

        it('should have error method that logs to console.error', async () => {
            const { default: logger } = await import('../../src/utils/logger.js');
            
            logger.error('error message');
            
            expect(mockConsoleError).toHaveBeenCalled();
        });

        it('should have error method with suggestion', async () => {
            const { default: logger } = await import('../../src/utils/logger.js');
            
            logger.error('error message', 'try this suggestion');
            
            expect(mockConsoleError).toHaveBeenCalledTimes(2);
        });

        it('should have json method that stringifies data', async () => {
            const { default: logger } = await import('../../src/utils/logger.js');
            const testData = { key: 'value', number: 123 };
            
            logger.json(testData);
            
            expect(mockConsoleLog).toHaveBeenCalled();
            const loggedData = mockConsoleLog.mock.calls[0][0];
            expect(typeof loggedData).toBe('string');
            expect(JSON.parse(loggedData)).toEqual(testData);
        });
    });

    describe('isIterm2 property', () => {
        it('should be false when no iTerm environment variables', async () => {
            const { default: logger } = await import('../../src/utils/logger.js');
            
            expect(logger.isIterm2).toBe(false);
        });

        it('should be true when TERM_PROGRAM is iTerm.app', async () => {
            process.env.TERM_PROGRAM = 'iTerm.app';
            const { default: logger } = await import('../../src/utils/logger.js');
            
            expect(logger.isIterm2).toBe(true);
        });

        it('should be true when ITERM_SESSION_ID is set', async () => {
            process.env.ITERM_SESSION_ID = 'w0t0p0:12345';
            const { default: logger } = await import('../../src/utils/logger.js');
            
            expect(logger.isIterm2).toBe(true);
        });
    });

    describe('image method', () => {
        it('should do nothing when buffer is falsy', async () => {
            const { default: logger } = await import('../../src/utils/logger.js');
            
            logger.image(null);
            logger.image(undefined);
            logger.image('');
            
            expect(mockProcessStdoutWrite).not.toHaveBeenCalled();
        });

        it('should do nothing when not in iTerm2 and not forced', async () => {
            const { default: logger } = await import('../../src/utils/logger.js');
            const buffer = Buffer.from('test');
            
            logger.image(buffer);
            
            expect(mockProcessStdoutWrite).not.toHaveBeenCalled();
        });

        it('should write to stdout when forced', async () => {
            const { default: logger } = await import('../../src/utils/logger.js');
            const buffer = Buffer.from('test');
            
            logger.image(buffer, true);
            
            expect(mockProcessStdoutWrite).toHaveBeenCalled();
        });

        it('should write to stdout when in iTerm2', async () => {
            process.env.TERM_PROGRAM = 'iTerm.app';
            vi.resetModules();
            const { default: logger } = await import('../../src/utils/logger.js');
            const buffer = Buffer.from('test');
            
            logger.image(buffer);
            
            expect(mockProcessStdoutWrite).toHaveBeenCalled();
        });
    });
});
