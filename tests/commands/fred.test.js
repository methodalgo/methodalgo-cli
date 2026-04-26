import { describe, it, expect, vi, beforeEach } from 'vitest';
import config from '../../src/utils/config-manager.js';
import logger from '../../src/utils/logger.js';
import * as fred from '../../src/utils/fred-api.js';

vi.mock('../../src/utils/config-manager.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
    }
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

vi.mock('../../src/utils/fred-api.js', () => ({
    getFredApiKey: vi.fn(),
    getSeries: vi.fn(),
    getSeriesObservations: vi.fn(),
    getSeriesSearch: vi.fn(),
    getCategory: vi.fn(),
    getCategoryChildren: vi.fn(),
    getCategorySeries: vi.fn(),
    getCategoryTags: vi.fn(),
    getReleases: vi.fn(),
    getReleasesDates: vi.fn(),
    getRelease: vi.fn(),
    getReleaseSeries: vi.fn(),
    getReleaseDates: vi.fn(),
    getReleaseSources: vi.fn(),
    getReleaseTags: vi.fn(),
    getReleaseTables: vi.fn(),
    getSources: vi.fn(),
    getSource: vi.fn(),
    getSourceReleases: vi.fn(),
    getTags: vi.fn(),
    getSeriesUpdates: vi.fn(),
    getSeriesVintageDates: vi.fn(),
    getGeoSeriesData: vi.fn(),
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

describe('fred Command Structure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        fred.getFredApiKey.mockReturnValue('test-key');
    });

    describe('Command structure', () => {
        it('should have correct command name', async () => {
            const { default: fredCmd } = await import('../../src/commands/fred.js');
            
            expect(fredCmd.name()).toBe('fred');
        });

        it('should have multiple subcommands', async () => {
            const { default: fredCmd } = await import('../../src/commands/fred.js');
            
            const subcommandNames = fredCmd.commands.map(c => c.name());
            
            expect(subcommandNames).toContain('search');
            expect(subcommandNames).toContain('get');
            expect(subcommandNames).toContain('info');
            expect(subcommandNames).toContain('latest');
            expect(subcommandNames).toContain('compare');
            expect(subcommandNames).toContain('changes');
            expect(subcommandNames).toContain('spread');
            expect(subcommandNames).toContain('liquidity');
            expect(subcommandNames).toContain('zscore');
            expect(subcommandNames).toContain('dashboard');
            expect(subcommandNames).toContain('recession');
            expect(subcommandNames).toContain('category');
            expect(subcommandNames).toContain('releases');
            expect(subcommandNames).toContain('release');
            expect(subcommandNames).toContain('sources');
            expect(subcommandNames).toContain('source');
            expect(subcommandNames).toContain('tags');
            expect(subcommandNames).toContain('updates');
            expect(subcommandNames).toContain('vintages');
            expect(subcommandNames).toContain('geo');
        });
    });
});
