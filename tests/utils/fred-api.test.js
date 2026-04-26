import { describe, it, expect, vi, beforeEach } from 'vitest';
import config from '../../src/utils/config-manager.js';

vi.mock('../../src/utils/config-manager.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
    }
}));

describe('fred-api Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        delete process.env.FRED_API_KEY;
        global.fetch = vi.fn();
    });

    describe('getFredApiKey function', () => {
        it('should return FRED_API_KEY from environment variable', async () => {
            process.env.FRED_API_KEY = 'env-fred-key';
            const { getFredApiKey } = await import('../../src/utils/fred-api.js');
            
            const result = getFredApiKey();
            expect(result).toBe('env-fred-key');
        });

        it('should return fredApiKey from config when env not set', async () => {
            config.get.mockReturnValue('config-fred-key');
            const { getFredApiKey } = await import('../../src/utils/fred-api.js');
            
            const result = getFredApiKey();
            expect(result).toBe('config-fred-key');
        });

        it('should return empty string when no key is set', async () => {
            config.get.mockReturnValue('');
            const { getFredApiKey } = await import('../../src/utils/fred-api.js');
            
            const result = getFredApiKey();
            expect(result).toBe('');
        });
    });

    describe('API functions exports', () => {
        it('should export all category functions', async () => {
            const {
                getCategory,
                getCategoryChildren,
                getCategoryRelated,
                getCategorySeries,
                getCategoryTags,
                getCategoryRelatedTags
            } = await import('../../src/utils/fred-api.js');
            
            expect(typeof getCategory).toBe('function');
            expect(typeof getCategoryChildren).toBe('function');
            expect(typeof getCategoryRelated).toBe('function');
            expect(typeof getCategorySeries).toBe('function');
            expect(typeof getCategoryTags).toBe('function');
            expect(typeof getCategoryRelatedTags).toBe('function');
        });

        it('should export all releases functions', async () => {
            const {
                getReleases,
                getReleasesDates,
                getRelease,
                getReleaseDates,
                getReleaseSeries,
                getReleaseSources,
                getReleaseTags,
                getReleaseRelatedTags,
                getReleaseTables
            } = await import('../../src/utils/fred-api.js');
            
            expect(typeof getReleases).toBe('function');
            expect(typeof getReleasesDates).toBe('function');
            expect(typeof getRelease).toBe('function');
            expect(typeof getReleaseDates).toBe('function');
            expect(typeof getReleaseSeries).toBe('function');
            expect(typeof getReleaseSources).toBe('function');
            expect(typeof getReleaseTags).toBe('function');
            expect(typeof getReleaseRelatedTags).toBe('function');
            expect(typeof getReleaseTables).toBe('function');
        });

        it('should export all series functions', async () => {
            const {
                getSeries,
                getSeriesCategories,
                getSeriesObservations,
                getSeriesRelease,
                getSeriesSearch,
                getSeriesSearchTags,
                getSeriesSearchRelatedTags,
                getSeriesTags,
                getSeriesUpdates,
                getSeriesVintageDates
            } = await import('../../src/utils/fred-api.js');
            
            expect(typeof getSeries).toBe('function');
            expect(typeof getSeriesCategories).toBe('function');
            expect(typeof getSeriesObservations).toBe('function');
            expect(typeof getSeriesRelease).toBe('function');
            expect(typeof getSeriesSearch).toBe('function');
            expect(typeof getSeriesSearchTags).toBe('function');
            expect(typeof getSeriesSearchRelatedTags).toBe('function');
            expect(typeof getSeriesTags).toBe('function');
            expect(typeof getSeriesUpdates).toBe('function');
            expect(typeof getSeriesVintageDates).toBe('function');
        });

        it('should export all sources functions', async () => {
            const {
                getSources,
                getSource,
                getSourceReleases
            } = await import('../../src/utils/fred-api.js');
            
            expect(typeof getSources).toBe('function');
            expect(typeof getSource).toBe('function');
            expect(typeof getSourceReleases).toBe('function');
        });

        it('should export all tags functions', async () => {
            const {
                getTags,
                getRelatedTags,
                getTagsSeries
            } = await import('../../src/utils/fred-api.js');
            
            expect(typeof getTags).toBe('function');
            expect(typeof getRelatedTags).toBe('function');
            expect(typeof getTagsSeries).toBe('function');
        });

        it('should export all GeoFRED functions', async () => {
            const {
                getGeoShapes,
                getGeoSeriesGroup,
                getGeoSeriesData,
                getGeoRegionalData
            } = await import('../../src/utils/fred-api.js');
            
            expect(typeof getGeoShapes).toBe('function');
            expect(typeof getGeoSeriesGroup).toBe('function');
            expect(typeof getGeoSeriesData).toBe('function');
            expect(typeof getGeoRegionalData).toBe('function');
        });
    });

    describe('API request behavior', () => {
        it('should throw error when no FRED API key is set', async () => {
            config.get.mockReturnValue('');
            const { getSeries } = await import('../../src/utils/fred-api.js');
            
            await expect(getSeries({ series_id: 'FEDFUNDS' })).rejects.toThrow('FRED API Key not configured');
        });

        it('should make fetch call with correct parameters when API key is set', async () => {
            process.env.FRED_API_KEY = 'test-fred-key';
            
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ seriess: [] })
            });
            
            const { getSeries } = await import('../../src/utils/fred-api.js');
            
            await getSeries({ series_id: 'FEDFUNDS' });
            
            expect(global.fetch).toHaveBeenCalled();
        });

        it('should throw error when fetch returns non-ok response', async () => {
            process.env.FRED_API_KEY = 'test-fred-key';
            
            global.fetch.mockResolvedValue({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                text: async () => 'Error message'
            });
            
            const { getSeries } = await import('../../src/utils/fred-api.js');
            
            await expect(getSeries({ series_id: 'INVALID' })).rejects.toThrow();
        });

        it('should throw error when fetch throws AbortError (timeout)', async () => {
            process.env.FRED_API_KEY = 'test-fred-key';
            
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            global.fetch.mockRejectedValue(abortError);
            
            const { getSeries } = await import('../../src/utils/fred-api.js');
            
            await expect(getSeries({ series_id: 'FEDFUNDS' })).rejects.toThrow('timed out');
        });
    });
});
