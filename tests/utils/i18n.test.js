import { describe, it, expect, vi, beforeEach } from 'vitest';
import { t, getLang } from '../../src/utils/i18n.js';
import config from '../../src/utils/config-manager.js';

// 模拟 config-manager
vi.mock('../../src/utils/config-manager.js', () => ({
  default: {
    get: vi.fn(),
  }
}));

describe('i18n Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLang()', () => {
    it('should return "en" as default if no language is set', () => {
      config.get.mockReturnValue(undefined);
      expect(getLang()).toBe('en');
    });

    it('should return "zh" if language is set to "zh"', () => {
      config.get.mockReturnValue('zh');
      expect(getLang()).toBe('zh');
    });
  });

  describe('t() - Translation Function', () => {
    it('should translate basic keys in English', () => {
      config.get.mockReturnValue('en');
      expect(t('ERR_NETWORK')).toBe('Network error');
    });

    it('should translate basic keys in Chinese', () => {
      config.get.mockReturnValue('zh');
      expect(t('ERR_NETWORK')).toBe('网络错误');
    });

    it('should fallback to English if key is missing in target language', () => {
      config.get.mockReturnValue('zh');
      // 假设某个 key 只在 en 中有
      expect(t('NON_EXISTENT_KEY')).toBe('NON_EXISTENT_KEY');
    });

    it('should replace placeholders correctly', () => {
      config.get.mockReturnValue('en');
      const result = t('SET_SUCCESS', { key: 'api-key', value: '123' });
      expect(result).toBe('Set api-key to 123');
    });

    it('should replace multiple placeholders in Chinese', () => {
      config.get.mockReturnValue('zh');
      const result = t('SET_SUCCESS', { key: 'lang', value: 'zh' });
      expect(result).toBe('已设置 lang 为 zh');
    });

    it('should handle complex templates (FRED_SEARCH_RESULTS)', () => {
      config.get.mockReturnValue('en');
      const result = t('FRED_SEARCH_RESULTS', { query: 'GDP', count: 10 });
      expect(result).toBe('Search results for GDP (10 total)');
    });
  });
});
