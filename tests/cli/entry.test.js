import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, '../../bin/index.js');
const { version } = createRequire(import.meta.url)('../../package.json');
const { METHODALGO_API_KEY, ...envWithoutKey } = process.env;

// 发版流程会在没有配置密钥的 runner 上启动程序做冒烟：查看版本与帮助这类命令必须无需登录即可成功
describe('CLI entry without a configured key', () => {
    let home;
    beforeAll(() => {
        home = mkdtempSync(join(tmpdir(), 'methodalgo-cli-test-'));
    });
    afterAll(() => {
        rmSync(home, { recursive: true, force: true });
    });

    const run = (args) => spawnSync(process.execPath, [cli, ...args], {
        encoding: 'utf8',
        env: { ...envWithoutKey, HOME: home, USERPROFILE: home },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 20000
    });

    it('prints the version without asking for a key', () => {
        const r = run(['--version']);

        expect(r.status).toBe(0);
        expect(r.stdout.trim()).toBe(version);
    });

    it('prints the version for the short flag too', () => {
        const r = run(['-V']);

        expect(r.status).toBe(0);
        expect(r.stdout.trim()).toBe(version);
    });

    it('shows help without arguments', () => {
        const r = run([]);

        expect(r.status).toBe(0);
        expect(r.stdout).toContain('Usage: methodalgo');
    });

    it('shows help with --help', () => {
        const r = run(['--help']);

        expect(r.status).toBe(0);
        expect(r.stdout).toContain('Usage: methodalgo');
    });

    it('shows help for a command via the help subcommand', () => {
        const r = run(['help', 'news']);

        expect(r.status).toBe(0);
        expect(r.stdout).toContain('Usage: methodalgo news');
    });

    // 数据命令必须要求登录：没有密钥、也没有交互输入时以退出码 1 结束，而不是挂起或假装成功
    it('fails data commands when there is no key and no interactive input', () => {
        const r = run(['news', '--type', 'breaking', '--limit', '1', '--json']);

        expect(r.status).toBe(1);
        expect(r.stderr).toContain('methodalgo login');
    });
});
