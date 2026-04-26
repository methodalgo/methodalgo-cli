import { describe, it, expect, vi, beforeEach } from 'vitest';

const RUN_INTEGRATION_TESTS = process.env.RUN_INTEGRATION_TESTS === 'true';
const TEST_API_KEY = process.env.TEST_METHODALGO_API_KEY;
const TEST_FRED_API_KEY = process.env.TEST_FRED_API_KEY;

vi.mock('../../src/utils/config-manager.js', () => ({
    default: {
        get: vi.fn((key) => {
            if (key === 'apiKey') return TEST_API_KEY || '';
            if (key === 'apiBase') return 'https://mm.methodalgo.com';
            if (key === 'lang') return 'zh';
            if (key === 'fredApiKey') return TEST_FRED_API_KEY || '';
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

    describe('FRED API Integration (requires TEST_FRED_API_KEY)', () => {
        it('should have FRED API key configured for testing', () => {
            if (TEST_FRED_API_KEY) {
                expect(TEST_FRED_API_KEY).toBeDefined();
                expect(TEST_FRED_API_KEY).not.toBe('');
            } else {
                console.log('Note: TEST_FRED_API_KEY not set, FRED tests will be skipped');
            }
        });

        it('should fetch FEDFUNDS data from FRED API', async () => {
            if (!TEST_FRED_API_KEY) {
                console.log('Skipping: TEST_FRED_API_KEY not set');
                return;
            }

            const { getSeriesObservations } = await import('../../src/utils/fred-api.js');
            
            const result = await getSeriesObservations({
                series_id: 'FEDFUNDS',
                limit: 2
            });

            expect(result).toBeDefined();
            expect(result.observations).toBeDefined();
            expect(Array.isArray(result.observations)).toBe(true);
        });
    });

    describe('Command Integration Tests', () => {
        it('should verify command exports are working correctly', async () => {
            const { default: newsCmd } = await import('../../src/commands/news.js');
            const { default: signalsCmd } = await import('../../src/commands/signals.js');
            const { default: configCmd } = await import('../../src/commands/config.js');

            expect(newsCmd).toBeDefined();
            expect(newsCmd.name()).toBe('news');
            
            expect(signalsCmd).toBeDefined();
            expect(signalsCmd.name()).toBe('signals');
            
            expect(configCmd).toBeDefined();
            expect(configCmd.name()).toBe('config');
        });

        it('should have all subcommands for config', async () => {
            const { default: configCmd } = await import('../../src/commands/config.js');
            
            const subcommandNames = configCmd.commands.map(c => c.name());
            expect(subcommandNames).toContain('set');
            expect(subcommandNames).toContain('get');
            expect(subcommandNames).toContain('list');
        });

        it('should have all subcommands for fred', async () => {
            const { default: fredCmd } = await import('../../src/commands/fred.js');
            
            const subcommandNames = fredCmd.commands.map(c => c.name());
            
            expect(subcommandNames.length).toBeGreaterThan(10);
            expect(subcommandNames).toContain('search');
            expect(subcommandNames).toContain('get');
            expect(subcommandNames).toContain('latest');
            expect(subcommandNames).toContain('dashboard');
        });
    });
});

describe('Integration Test Environment', () => {
    it('should show test environment info', () => {
        console.log('\n=== Integration Test Environment ===');
        console.log('RUN_INTEGRATION_TESTS:', RUN_INTEGRATION_TESTS);
        console.log('TEST_METHODALGO_API_KEY set:', !!TEST_API_KEY);
        console.log('TEST_FRED_API_KEY set:', !!TEST_FRED_API_KEY);
        console.log('===================================\n');
        
        expect(true).toBe(true);
    });
});
