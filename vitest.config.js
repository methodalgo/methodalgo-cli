import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.js'],
            exclude: [
                'src/**/*.test.js',
                'src/**/*.spec.js',
                'node_modules/',
                'scripts/',
                'sea-config.json',
                '.trae/'
            ],
            all: true,
            thresholds: {
                global: {
                    statements: 50,
                    branches: 40,
                    functions: 40,
                    lines: 50
                }
            }
        },
        environment: 'node'
    }
});
