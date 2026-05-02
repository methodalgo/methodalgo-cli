import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('conf', () => {
    const mockStore = {};
    class MockConf {
        constructor(options) {
            this._options = options;
        }
        get(key) {
            return mockStore[key];
        }
        set(key, value) {
            if (typeof key === 'object') {
                Object.assign(mockStore, key);
            } else {
                mockStore[key] = value;
            }
        }
        get store() {
            return mockStore;
        }
    }
    return {
        default: MockConf
    };
});

describe('config-manager Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('Default exports and constants', () => {
        it('should export default config instance', async () => {
            const { default: config } = await import('../../src/utils/config-manager.js');
            
            expect(config).toBeDefined();
            expect(typeof config.get).toBe('function');
            expect(typeof config.set).toBe('function');
        });

        it('should export dashboard constants', async () => {
            const { 
                DEFAULT_DASHBOARD,
                DEFAULT_DASHBOARD_PANELS,
                DEFAULT_DASHBOARD_TICKER,
                DEFAULT_DASHBOARD_THEME,
                DEFAULT_DASHBOARD_KEYBINDINGS
            } = await import('../../src/utils/config-manager.js');
            
            expect(DEFAULT_DASHBOARD).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS).toBeDefined();
            expect(DEFAULT_DASHBOARD_TICKER).toBeDefined();
            expect(DEFAULT_DASHBOARD_THEME).toBeDefined();
            expect(DEFAULT_DASHBOARD_KEYBINDINGS).toBeDefined();
        });

        it('should have panel defaults defined', async () => {
            const { DEFAULT_DASHBOARD_PANELS } = await import('../../src/utils/config-manager.js');
            
            expect(DEFAULT_DASHBOARD_PANELS.article).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS.breaking).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS.onchain).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS.report).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS.breakout).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS.exhaustion).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS.goldenPit).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS.liquidation).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS.clock).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS.marketToday).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS.tokenUnlock).toBeDefined();
            expect(DEFAULT_DASHBOARD_PANELS.binanceSpotMovers24h).toMatchObject({ enabled: false, column: 3 });
            expect(DEFAULT_DASHBOARD_PANELS.binanceFuturesMovers24h).toMatchObject({ enabled: false, column: 3 });
        });

        it('should have ticker defaults with sources', async () => {
            const { DEFAULT_DASHBOARD_TICKER } = await import('../../src/utils/config-manager.js');
            
            expect(DEFAULT_DASHBOARD_TICKER.enabled).toBe(true);
            expect(DEFAULT_DASHBOARD_TICKER.sources).toBeDefined();
            expect(DEFAULT_DASHBOARD_TICKER.sources.length).toBeGreaterThan(0);
        });

        it('should have keybinding defaults', async () => {
            const { DEFAULT_DASHBOARD_KEYBINDINGS } = await import('../../src/utils/config-manager.js');
            
            expect(DEFAULT_DASHBOARD_KEYBINDINGS.quit).toBe('q');
            expect(DEFAULT_DASHBOARD_KEYBINDINGS.settings).toBe('s');
            expect(DEFAULT_DASHBOARD_KEYBINDINGS.refresh).toBe('r');
            expect(DEFAULT_DASHBOARD_KEYBINDINGS.search).toBe('f');
        });
    });

    describe('Dashboard configuration functions', () => {
        it('should export getDashboardConfig function', async () => {
            const { getDashboardConfig } = await import('../../src/utils/config-manager.js');
            
            expect(typeof getDashboardConfig).toBe('function');
        });

        it('should export setDashboardConfig function', async () => {
            const { setDashboardConfig } = await import('../../src/utils/config-manager.js');
            
            expect(typeof setDashboardConfig).toBe('function');
        });

        it('should export resetDashboardConfig function', async () => {
            const { resetDashboardConfig } = await import('../../src/utils/config-manager.js');
            
            expect(typeof resetDashboardConfig).toBe('function');
        });

        it('should export getPanelConfig function', async () => {
            const { getPanelConfig } = await import('../../src/utils/config-manager.js');
            
            expect(typeof getPanelConfig).toBe('function');
        });

        it('should export setPanelConfig function', async () => {
            const { setPanelConfig } = await import('../../src/utils/config-manager.js');
            
            expect(typeof setPanelConfig).toBe('function');
        });

        it('should export getTickerConfig function', async () => {
            const { getTickerConfig } = await import('../../src/utils/config-manager.js');
            
            expect(typeof getTickerConfig).toBe('function');
        });

        it('should export getThemeConfig function', async () => {
            const { getThemeConfig } = await import('../../src/utils/config-manager.js');
            
            expect(typeof getThemeConfig).toBe('function');
        });

        it('should export getEnabledPanels function', async () => {
            const { getEnabledPanels } = await import('../../src/utils/config-manager.js');
            
            expect(typeof getEnabledPanels).toBe('function');
        });

        it('should export getPanelsByColumn function', async () => {
            const { getPanelsByColumn } = await import('../../src/utils/config-manager.js');
            
            expect(typeof getPanelsByColumn).toBe('function');
        });

        it('should export getKeybindings function', async () => {
            const { getKeybindings } = await import('../../src/utils/config-manager.js');
            
            expect(typeof getKeybindings).toBe('function');
        });
    });
});
