import { describe, it, expect, vi, beforeEach } from 'vitest';

const RUN_INTEGRATION_TESTS = process.env.RUN_INTEGRATION_TESTS === 'true';
const TEST_API_KEY = process.env.TEST_METHODALGO_API_KEY;

vi.mock('../../src/utils/config-manager.js', () => ({
    default: {
        get: vi.fn((key) => {
            if (key === 'apiKey') return TEST_API_KEY || '';
            if (key === 'apiBase') return 'https://mm.methodalgo.com';
            if (key === 'lang') return 'zh';
            return undefined;
        }),
        set: vi.fn(),
    },
    getDashboardConfig: vi.fn(),
    getEnabledPanels: vi.fn(),
    getPanelsByColumn: vi.fn(),
    getTickerConfig: vi.fn(),
}));

vi.mock('../../src/utils/i18n.js', () => ({
    t: vi.fn((key, params) => {
        if (key === 'FETCH_SUCCESS' && params?.count !== undefined) {
            return `获取到 ${params.count} 条结果:`;
        }
        if (key === 'ERR_NETWORK') return '网络错误';
        return key;
    }),
    getLang: vi.fn(() => 'zh')
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

const conditionalDescribe = RUN_INTEGRATION_TESTS ? describe : describe.skip;

conditionalDescribe('Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('API Integration (requires TEST_METHODALGO_API_KEY)', () => {
        it('should have API key configured for testing', () => {
            expect(TEST_API_KEY).toBeDefined();
            expect(TEST_API_KEY).not.toBe('');
        });

        it('should be able to make real signed requests', async () => {
            if (!TEST_API_KEY) {
                console.log('Skipping: TEST_METHODALGO_API_KEY not set');
                return;
            }

            const { signedRequest, validateApiKey } = await import('../../src/utils/api.js');
            
            const isValid = await validateApiKey(TEST_API_KEY);
            expect(isValid).toBe(true);
        });

        it('should fetch news data from real API', async () => {
            if (!TEST_API_KEY) {
                console.log('Skipping: TEST_METHODALGO_API_KEY not set');
                return;
            }

            const { signedRequest } = await import('../../src/utils/api.js');
            
            const result = await signedRequest('/cli/news', {
                type: 'news',
                limit: 2,
                lang: 'zh'
            });

            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.data.status).toBe(true);
        });
    });

    describe('Command Integration Tests', () => {
        it('should verify command exports are working correctly', async () => {
            const { default: newsCmd } = await import('../../src/commands/news.js');
            const { default: signalsCmd } = await import('../../src/commands/signals.js');
            const { default: configCmd } = await import('../../src/commands/config.js');
            const { default: binanceCmd } = await import('../../src/commands/binance.js');
            const { default: macroCmd } = await import('../../src/commands/macro.js');
            const { default: totalsCmd } = await import('../../src/commands/totals.js');

            expect(newsCmd).toBeDefined();
            expect(newsCmd.name()).toBe('news');
            
            expect(signalsCmd).toBeDefined();
            expect(signalsCmd.name()).toBe('signals');
            
            expect(configCmd).toBeDefined();
            expect(configCmd.name()).toBe('config');

            expect(binanceCmd).toBeDefined();
            expect(binanceCmd.name()).toBe('binance');

            expect(macroCmd).toBeDefined();
            expect(macroCmd.name()).toBe('macro');

            expect(totalsCmd).toBeDefined();
            expect(totalsCmd.name()).toBe('totals');
        });

        it('should have all subcommands for config', async () => {
            const { default: configCmd } = await import('../../src/commands/config.js');
            
            const subcommandNames = configCmd.commands.map(c => c.name());
            expect(subcommandNames).toContain('set');
            expect(subcommandNames).toContain('get');
            expect(subcommandNames).toContain('list');
        });

        it('should have macro replacement subcommands', async () => {
            const { default: macroCmd } = await import('../../src/commands/macro.js');
            
            const subcommandNames = macroCmd.commands.map(c => c.name());
            
            expect(subcommandNames.length).toBeGreaterThan(10);
            expect(subcommandNames).toContain('search');
            expect(subcommandNames).toContain('get');
            expect(subcommandNames).toContain('latest');
            expect(subcommandNames).toContain('dashboard');
        });
    });
});

describe('Integration Test Environment', () => {
    it('should register totals and not import the removed fred command', async () => {
        const { readFileSync } = await import('fs');
        const source = readFileSync(new URL('../../src/index.js', import.meta.url), 'utf8');

        expect(source).toContain('./commands/totals.js');
        expect(source).not.toContain('./commands/fred.js');
    });

    it('should show test environment info', () => {
        console.log('\n=== Integration Test Environment ===');
        console.log('RUN_INTEGRATION_TESTS:', RUN_INTEGRATION_TESTS);
        console.log('TEST_METHODALGO_API_KEY set:', !!TEST_API_KEY);
        console.log('===================================\n');
        
        expect(true).toBe(true);
    });
});
