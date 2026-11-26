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
            // vitest 4 起阈值为扁平配置（嵌套在 global 下会被当作文件匹配模式而失效）；数值取当前覆盖率略下方，仅用于防止倒退
            thresholds: {
                statements: 33,
                branches: 27,
                functions: 34,
                lines: 34
            }
        },
        environment: 'node'
    }
});
