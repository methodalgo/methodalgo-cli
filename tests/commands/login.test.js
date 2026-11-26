import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import config from '../../src/utils/config-manager.js';
import logger from '../../src/utils/logger.js';

vi.mock('../../src/utils/config-manager.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
    }
}));

vi.mock('../../src/utils/onboard.js', () => ({
    startOnboarding: vi.fn()
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

    describe('Non-interactive standard input', () => {
        const stdinIsTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

        beforeEach(() => {
            Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true });
        });

        afterEach(() => {
            Object.defineProperty(process.stdin, 'isTTY', { ...stdinIsTTY, configurable: true });
        });

        // 登录必须在交互式终端里进行：没有终端输入时要明确失败，不能停在“是否重新登录”的询问上，更不能清空已存的密钥
        it('should fail without prompting or clearing the stored key', async () => {
            const readline = (await import('readline')).default;
            const { startOnboarding } = await import('../../src/utils/onboard.js');
            config.get.mockImplementation((key) => (key === 'apiKey' ? 'test-auth-token' : 'en'));
            const { default: loginCmd } = await import('../../src/commands/login.js');

            await loginCmd.parseAsync(['node', 'login'], { from: 'node' });

            expect(logger.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('methodalgo login'));
            expect(readline.createInterface).not.toHaveBeenCalled();
            expect(config.set).not.toHaveBeenCalled();
            expect(startOnboarding).not.toHaveBeenCalled();
        });
    });
});
