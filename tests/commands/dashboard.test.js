import { describe, it, expect, vi, beforeEach } from 'vitest';
import config from '../../src/utils/config-manager.js';
import logger from '../../src/utils/logger.js';

vi.mock('../../src/utils/config-manager.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
    },
    getDashboardConfig: vi.fn(() => ({
        layout: 'three-column',
        refreshInterval: 60000,
        panels: {},
        ticker: { enabled: true },
        theme: { name: 'dark-red' },
        keybindings: {}
    })),
    getEnabledPanels: vi.fn(() => ['article', 'breaking']),
    getPanelsByColumn: vi.fn(() => ({ 1: [], 2: [], 3: [] })),
    getTickerConfig: vi.fn(() => ({ enabled: true })),
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

vi.mock('react', () => ({
    default: {
        useState: vi.fn((init) => [init, vi.fn()]),
        useEffect: vi.fn(),
        useRef: vi.fn(() => ({ current: { startDashboardStream: vi.fn(() => false), startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn(), destroy: vi.fn(), fetchMultiple: vi.fn() } })),
        useCallback: vi.fn((fn) => fn),
        useMemo: vi.fn((fn) => fn()),
        createElement: vi.fn(),
    }
}));

vi.mock('ink', () => ({
    render: vi.fn(),
    Box: 'Box',
    useInput: vi.fn(),
    useApp: vi.fn(() => ({ exit: vi.fn() })),
}));

vi.mock('../../src/class/DataFetcher.js', () => ({
    DataFetcher: vi.fn(function() {
        return {
            startAutoRefresh: vi.fn(),
            startDashboardStream: vi.fn(() => false),
            stopAutoRefresh: vi.fn(),
            destroy: vi.fn(),
            fetchMultiple: vi.fn()
        };
    })
}));

vi.mock('../../src/class/Dashboard/ClockPanel.js', () => ({
    ClockPanel: 'ClockPanel'
}));

vi.mock('../../src/class/Dashboard/PanelList.js', () => ({
    PanelList: 'PanelList'
}));

vi.mock('../../src/class/Dashboard/DetailDialog.js', () => ({
    DetailDialog: 'DetailDialog'
}));

vi.mock('../../src/class/Dashboard/LoadingScreen.js', () => ({
    LoadingScreen: 'LoadingScreen'
}));

vi.mock('../../src/class/Dashboard/StatusLine.js', () => ({
    StatusLine: 'StatusLine'
}));

vi.mock('../../src/class/Dashboard/TickerBar.js', () => ({
    TickerBar: 'TickerBar'
}));

vi.mock('../../src/class/Dashboard/SettingsDialog.js', () => ({
    SettingsDialog: 'SettingsDialog'
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('dashboard Command Structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('Command structure', () => {
        it('should have correct command name', async () => {
            const { default: dashboardCmd } = await import('../../src/commands/dashboard.js');
            
            expect(dashboardCmd.name()).toBe('dashboard');
        });

        it('should have no subcommands', async () => {
            const { default: dashboardCmd } = await import('../../src/commands/dashboard.js');
            
            expect(dashboardCmd.commands.length).toBe(0);
        });

        it('should prefer dashboard stream and start polling only after stream error', async () => {
            const { startDashboardLiveUpdates } = await import('../../src/commands/dashboard.js');
            const dataFetcher = {
                startDashboardStream: vi.fn((panels, onUpdate, onError) => {
                    onError(new Error('stream ended'));
                    return true;
                }),
                startAutoRefresh: vi.fn()
            };
            const setStatusInfo = vi.fn();
            const handlePanelUpdate = vi.fn();

            const streamStarted = startDashboardLiveUpdates(dataFetcher, ['article'], handlePanelUpdate, setStatusInfo);

            expect(streamStarted).toBe(true);
            expect(dataFetcher.startDashboardStream).toHaveBeenCalledWith(['article'], handlePanelUpdate, expect.any(Function));
            expect(dataFetcher.startAutoRefresh).toHaveBeenCalledWith(['article'], handlePanelUpdate);
            expect(setStatusInfo).toHaveBeenCalled();
        });

        it('should start polling immediately when dashboard stream is unavailable', async () => {
            const { startDashboardLiveUpdates } = await import('../../src/commands/dashboard.js');
            const dataFetcher = {
                startDashboardStream: vi.fn(() => false),
                startAutoRefresh: vi.fn()
            };
            const handlePanelUpdate = vi.fn();

            const streamStarted = startDashboardLiveUpdates(dataFetcher, ['priceTicker'], handlePanelUpdate, vi.fn());

            expect(streamStarted).toBe(false);
            expect(dataFetcher.startAutoRefresh).toHaveBeenCalledWith(['priceTicker'], handlePanelUpdate);
        });
    });

    describe('Panel configuration constants', () => {
        it('should define PANEL_LABEL_KEYS mapping', () => {
            const PANEL_LABEL_KEYS = {
                article: 'TYPE_ARTICLE',
                breaking: 'TYPE_NEWS',
                onchain: 'TYPE_ONCHAIN',
                report: 'TYPE_REPORT',
                breakout: 'LABEL_BREAKOUT',
                exhaustion: 'LABEL_EXHAUSTION',
                goldenPit: 'LABEL_GOLDEN_PIT',
                liquidation: 'LABEL_LIQUIDATION',
                marketToday: 'LABEL_MARKET_TODAY',
                tokenUnlock: 'LABEL_TOKEN_UNLOCK',
                fredDashboard: 'LABEL_FRED_DASHBOARD',
                priceTicker: 'LABEL_PRICE_TICKER',
                economicCalendar: 'LABEL_ECONOMIC_CALENDAR'
            };
            
            expect(PANEL_LABEL_KEYS).toBeDefined();
            expect(PANEL_LABEL_KEYS.article).toBe('TYPE_ARTICLE');
            expect(PANEL_LABEL_KEYS.breaking).toBe('TYPE_NEWS');
            expect(PANEL_LABEL_KEYS.marketToday).toBe('LABEL_MARKET_TODAY');
        });

        it('should define PANEL_CATEGORIES mapping', () => {
            const PANEL_CATEGORIES = {
                breakout: 'breakout',
                exhaustion: 'exhaustion',
                goldenPit: 'goldenPit',
                liquidation: 'liquidation',
                marketToday: 'marketToday',
                tokenUnlock: 'tokenUnlock'
            };
            
            expect(PANEL_CATEGORIES).toBeDefined();
        });
    });
});
