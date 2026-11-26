import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const launch = resolve(here, '../../scripts/sea-launch.cjs');
const seaStub = resolve(here, 'fixtures/sea-stub.cjs');

// 与 src/index.js 相同的版本读取方式：入口按相对自身目录的 ../package.json 取版本号
// 与 src/utils/constants.js 相同的版本读取方式：横幅从文件路径上溯三级取版本号，读不到则回退 1.0.0
const entry = `
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
console.log("BUNDLE_DIR=" + __dirname);
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8"));
console.log("BUNDLE_VERSION=" + pkg.version);
let bannerVersion = "1.0.0";
try {
    bannerVersion = JSON.parse(readFileSync(resolve(fileURLToPath(import.meta.url), "../../..", "package.json"), "utf-8")).version;
} catch (e) {}
console.log("BANNER_VERSION=" + bannerVersion);
`;

// 在普通 Node 里运行真实的启动垫片，资产由预加载钩子伪造
const launchBinary = (assets) => spawnSync(process.execPath, ['-r', seaStub, launch], {
    encoding: 'utf8',
    env: { ...process.env, SEA_STUB_ASSETS: JSON.stringify(assets) },
    timeout: 20000
});
const output = (text, key) => (text.split('\n').find((line) => line.startsWith(key + '=')) || '').slice(key.length + 1);

describe('SEA launcher', () => {
    // 发布出的二进制自引入 SEA 起就一直启动即崩溃：入口读不到 package.json 就无法加载
    it('extracts the entry so that ../package.json resolves next to it', () => {
        const r = launchBinary({ 'index.mjs': entry, 'package.json': '{"version":"9.9.9"}' });

        expect(output(r.stdout, 'BUNDLE_VERSION')).toBe('9.9.9');
        expect(r.status).toBe(0);
    });

    // 横幅显示的版本号必须与 --version 一致，不能回退成默认的 1.0.0
    it('lets the banner resolve package.json from three levels up the file path', () => {
        const r = launchBinary({ 'index.mjs': entry, 'package.json': '{"version":"9.9.9"}' });

        expect(output(r.stdout, 'BANNER_VERSION')).toBe('9.9.9');
    });

    it('cleans up every extracted file when the process exits', () => {
        const r = launchBinary({ 'index.mjs': entry, 'package.json': '{"version":"9.9.9"}' });

        expect(output(r.stdout, 'BUNDLE_DIR')).not.toBe('');
        expect(existsSync(output(r.stdout, 'BUNDLE_DIR'))).toBe(false);
    });

    it('fails with a clear error when the entry asset is missing', () => {
        const r = launchBinary({});

        expect(r.status).toBe(1);
        expect(r.stderr).toContain('Corrupted binary');
    });
});
