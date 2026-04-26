import { describe, it, expect, vi, beforeEach } from 'vitest';
import config from '../../src/utils/config-manager.js';

vi.mock('../../src/utils/config-manager.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        store: {}
    }
}));

vi.mock('../../src/utils/i18n.js', () => ({
    t: vi.fn((key) => key)
}));

describe('api Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        delete process.env.METHODALGO_API_KEY;
        global.fetch = vi.fn();
    });

    describe('signedRequest function', () => {
        it('should throw error when no API key is set', async () => {
            config.get.mockImplementation((key) => {
                if (key === 'apiKey') return '';
                if (key === 'apiBase') return 'https://mm.methodalgo.com';
                return undefined;
            });
            
            const { signedRequest } = await import('../../src/utils/api.js');
            
            await expect(signedRequest('/cli/news')).rejects.toThrow();
        });

        it('should use API key from environment variable', async () => {
            process.env.METHODALGO_API_KEY = 'env-api-key';
            config.get.mockImplementation((key) => {
                if (key === 'apiBase') return 'https://mm.methodalgo.com';
                return '';
            });
            
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ status: true, data: [] }),
                headers: new Map()
            });
            
            const { signedRequest } = await import('../../src/utils/api.js');
            
            await signedRequest('/cli/news');
            
            expect(global.fetch).toHaveBeenCalled();
        });

        it('should use API key from config', async () => {
            config.get.mockImplementation((key) => {
                if (key === 'apiKey') return 'config-api-key';
                if (key === 'apiBase') return 'https://mm.methodalgo.com';
                return undefined;
            });
            
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ status: true, data: [] }),
                headers: new Map()
            });
            
            const { signedRequest } = await import('../../src/utils/api.js');
            
            await signedRequest('/cli/news');
            
            expect(global.fetch).toHaveBeenCalled();
        });

        it('should return JSON response on success', async () => {
            config.get.mockImplementation((key) => {
                if (key === 'apiKey') return 'test-api-key';
                if (key === 'apiBase') return 'https://mm.methodalgo.com';
                return undefined;
            });
            
            const mockData = { status: true, data: [{ id: 1 }] };
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockData,
                headers: new Map([['content-type', 'application/json']])
            });
            
            const { signedRequest } = await import('../../src/utils/api.js');
            
            const result = await signedRequest('/cli/news');
            
            expect(result.data).toEqual(mockData);
            expect(result.headers).toBeDefined();
        });

        it('should throw error when response is not ok', async () => {
            config.get.mockImplementation((key) => {
                if (key === 'apiKey') return 'test-api-key';
                if (key === 'apiBase') return 'https://mm.methodalgo.com';
                return undefined;
            });
            
            global.fetch.mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                json: async () => ({ msg: 'Invalid API key' })
            });
            
            const { signedRequest } = await import('../../src/utils/api.js');
            
            await expect(signedRequest('/cli/news')).rejects.toThrow();
        });

        it('should handle arraybuffer response type', async () => {
            config.get.mockImplementation((key) => {
                if (key === 'apiKey') return 'test-api-key';
                if (key === 'apiBase') return 'https://mm.methodalgo.com';
                return undefined;
            });
            
            const mockBuffer = new ArrayBuffer(8);
            global.fetch.mockResolvedValue({
                ok: true,
                arrayBuffer: async () => mockBuffer,
                headers: new Map([['content-type', 'image/png']])
            });
            
            const { signedRequest } = await import('../../src/utils/api.js');
            
            const result = await signedRequest('/cli/snapshot', {}, { responseType: 'arraybuffer' });
            
            expect(result.data).toBe(mockBuffer);
        });
    });

    describe('validateApiKey function', () => {
        it('should return false when apiKey is empty', async () => {
            const { validateApiKey } = await import('../../src/utils/api.js');
            
            const result = await validateApiKey('');
            
            expect(result).toBe(false);
        });

        it('should return true on successful validation', async () => {
            config.get.mockReturnValue('https://mm.methodalgo.com');
            
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ status: true })
            });
            
            const { validateApiKey } = await import('../../src/utils/api.js');
            
            const result = await validateApiKey('valid-key');
            
            expect(result).toBe(true);
        });

        it('should return false on network error', async () => {
            config.get.mockReturnValue('https://mm.methodalgo.com');
            
            global.fetch.mockRejectedValue(new Error('Network error'));
            
            const { validateApiKey } = await import('../../src/utils/api.js');
            
            const result = await validateApiKey('test-key');
            
            expect(result).toBe(false);
        });

        it('should return false when response is not ok', async () => {
            config.get.mockReturnValue('https://mm.methodalgo.com');
            
            global.fetch.mockResolvedValue({
                ok: false,
                status: 401
            });
            
            const { validateApiKey } = await import('../../src/utils/api.js');
            
            const result = await validateApiKey('invalid-key');
            
            expect(result).toBe(false);
        });

        it('should return false when status is false', async () => {
            config.get.mockReturnValue('https://mm.methodalgo.com');
            
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ status: false })
            });
            
            const { validateApiKey } = await import('../../src/utils/api.js');
            
            const result = await validateApiKey('key-with-error');
            
            expect(result).toBe(false);
        });
    });
});
