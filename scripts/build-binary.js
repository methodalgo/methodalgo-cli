import { execSync } from 'node:child_process';
import { existsSync, cpSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

const NODE_VERSION = 'v22.14.0';
const APP_NAME = 'methodalgo';

// 定义支持的目标平台及其下载路径
const TARGETS = [
  { os: 'darwin', arch: 'arm64', suffix: '-macos-arm64' },
  { os: 'darwin', arch: 'x64', suffix: '-macos-x64' },
  { os: 'win32', arch: 'x64', suffix: '-win-x64.exe' },
  { os: 'linux', arch: 'x64', suffix: '-linux-x64' }
];

function run(cmd, args, options = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  execSync(`${cmd} ${args.join(' ')}`, { stdio: 'inherit', cwd: root, ...options });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

// 模拟下载和获取 Node 二进制的逻辑
async function getBaseBinary(target) {
  const cacheDir = join(root, 'cache', 'node-binaries');
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

  // 如果是当前平台，直接用系统的
  if (target.os === process.platform && target.arch === process.arch) {
    console.log(`Using local Node binary for ${target.os}-${target.arch}`);
    return process.execPath;
  }

  // 构建下载 URL (这里简化逻辑，假设我们下载特定平台的 node 可执行文件)
  // 实际上 Node.js 官网提供的是压缩包。为了脚本精简且可靠，
  // 我们在本地开发环境下如果确实需要交叉编译，
  // 这里可以抛出指引或通过 curl 下载并解压。
  
  // 🚨 为保证极致性能，我们优先使用 curl 命令，因为它在 Mac/Linux/Win10+ 均内置且更稳固
  const binName = target.os === 'win32' ? 'node.exe' : 'node';
  const platformFolder = `node-${NODE_VERSION}-${target.os === 'win32' ? 'win' : target.os}-${target.arch}`;
  const ext = target.os === 'win32' ? 'zip' : 'tar.gz';
  const url = `https://nodejs.org/dist/${NODE_VERSION}/${platformFolder}.${ext}`;
  const localArchive = join(cacheDir, `${platformFolder}.${ext}`);
  const extractedBin = join(cacheDir, platformFolder, binName === 'node.exe' ? binName : `bin/${binName}`);

  if (!existsSync(extractedBin)) {
    console.log(`Downloading ${url}...`);
    if (!existsSync(localArchive)) {
      run('curl', ['-L', url, '-o', localArchive]);
    }
    
    console.log(`Extracting ${localArchive}...`);
    const tempExtractDir = join(cacheDir, platformFolder);
    mkdirSync(tempExtractDir, { recursive: true });
    
    if (ext === 'zip') {
      run('unzip', ['-o', localArchive, '-d', cacheDir]);
    } else {
      run('tar', ['-xzf', localArchive, '-C', cacheDir]);
    }
  }

  // 坑位适配：Windows 的提取路径通常直接在根目录，而 Linux/macOS 在 bin/ 下
  const finalPath = target.os === 'win32' 
    ? join(cacheDir, platformFolder, 'node.exe')
    : join(cacheDir, platformFolder, 'bin', 'node');

  return finalPath;
}

async function main() {
  console.log('🚀 --- methodalgo-cli Multi-Platform SEA Build Started ---');

  // 1. esbuild 打包逻辑 (共享逻辑)
  console.log('\n[1/4] Bundling with esbuild...');
  const esbuildBanner = "const require = (await import('node:module')).createRequire(import.meta.url); const __filename = (await import('node:url')).fileURLToPath(import.meta.url); const __dirname = (await import('node:path')).dirname(__filename);";

  run('npx', [
    'esbuild', 'src/index.js',
    '--bundle', '--platform=node', '--format=esm',
    '--outfile=dist/index.mjs', '--minify',
    `--banner:js="${esbuildBanner}"`
  ]);

  // 2. 生成通用 SEA Blob
  console.log('\n[2/4] Generating Generic SEA Blob...');
  run('node', ['--experimental-sea-config', 'sea-config.json']);

  // 3. 为每个目标平台生成二进制
  console.log('\n[3/4] Packaging platforms...');
  const binariesDir = join(root, 'binaries');
  if (!existsSync(binariesDir)) mkdirSync(binariesDir, { recursive: true });

  for (const target of TARGETS) {
    const platformId = `${target.os}-${target.arch}`;
    console.log(`\n📦 Processing: ${platformId}...`);

    try {
      const baseNodePath = await getBaseBinary(target);
      const outputName = `${APP_NAME}${target.suffix}`;
      const outputPath = join(binariesDir, outputName);

      console.log(`- Copying kernel: ${baseNodePath} -> ${outputPath}`);
      cpSync(baseNodePath, outputPath);

      if (target.os === 'darwin') {
        console.log('- Removing signature (macOS only)...');
        run('codesign', ['--remove-signature', outputPath]);
      }

      console.log(`- Injecting Blob...`);
      const sentinelFuse = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
      const postjectArgs = [
        'postject', outputPath, 'NODE_SEA_BLOB', 'dist/sea-prep.blob',
        '--sentinel-fuse', sentinelFuse, '--overwrite'
      ];
      if (target.os === 'darwin') postjectArgs.push('--macho-segment-name', 'NODE_SEA');
      run('npx', postjectArgs);

      if (target.os === 'darwin') {
        console.log('- Re-signing (macOS only)...');
        run('codesign', ['--sign', '-', outputPath]);
      }

      console.log(`✅ ${platformId} Build OK!`);
    } catch (err) {
      console.error(`❌ ${platformId} Build Failed:`, err.message);
    }
  }

  console.log('\n✨ --- All Done! Check binaries/ folder. ---');
}

main().catch(err => {
  console.error('Fatal Build Error:', err);
  process.exit(1);
});
