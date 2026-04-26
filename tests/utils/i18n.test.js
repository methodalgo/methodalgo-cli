import { describe, it, expect, vi, beforeEach } from 'vitest';
import config from '../../src/utils/config-manager.js';

vi.mock('../../src/utils/config-manager.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
    }
}));

describe('i18n Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    describe('getLang function', () => {
        it('should return config lang when set', async () => {
            config.get.mockReturnValue('zh');
            const { getLang } = await import('../../src/utils/i18n.js');
            
            const result = getLang();
            expect(result).toBe('zh');
        });

        it('should return "en" as default when lang is not set', async () => {
            config.get.mockReturnValue(undefined);
            const { getLang } = await import('../../src/utils/i18n.js');
            
            const result = getLang();
            expect(result).toBe('en');
        });
    });

    describe('t function (translation)', () => {
        it('should return translation for existing key', async () => {
            config.get.mockReturnValue('en');
            const { t } = await import('../../src/utils/i18n.js');
            
            const result = t('FETCH_SUCCESS', { count: 5 });
            expect(result).toContain('5');
            expect(result).toContain('Fetched');
        });

        it('should return Chinese translation when lang is zh', async () => {
            config.get.mockReturnValue('zh');
            const { t } = await import('../../src/utils/i18n.js');
            
            const result = t('FETCH_SUCCESS', { count: 5 });
            expect(result).toContain('5');
            expect(result).toContain('获取');
        });

        it('should replace placeholder parameters', async () => {
            config.get.mockReturnValue('en');
            const { t } = await import('../../src/utils/i18n.js');
            
            const result = t('SET_SUCCESS', { key: 'lang', value: 'zh' });
            expect(result).toBe('Set lang to zh');
        });

        it('should fallback to English when key not in current language', async () => {
            config.get.mockReturnValue('zh');
            const { t } = await import('../../src/utils/i18n.js');
            
            const result = t('HELP_DESC');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return key itself when not found in any language', async () => {
            config.get.mockReturnValue('en');
            const { t } = await import('../../src/utils/i18n.js');
            
            const result = t('NON_EXISTENT_KEY_12345');
            expect(result).toBe('NON_EXISTENT_KEY_12345');
        });
    });
});
