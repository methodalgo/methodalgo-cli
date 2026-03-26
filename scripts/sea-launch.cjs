const { getAsset } = require('node:sea');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const process = require('node:process');
const { pathToFileURL } = require('node:url');

async function main() {
  const content = getAsset('index.mjs');
  if (!content) {
    console.error('Fatal Error: Corrupted binary. Cannot find index.mjs asset.');
    process.exit(1);
  }

  // Generate a predictable temp dir name for caching if possible, or just a random one.
  const appPrefix = 'methodalgo-cli-';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), appPrefix));
  const mjsPath = path.join(tmpDir, 'index.mjs');

  try {
    // Write ESM bundle to a temporary file
    fs.writeFileSync(mjsPath, new Uint8Array(content), { mode: 0o755 });

    // Clean up function
    const cleanup = () => {
      try {
        if (fs.existsSync(tmpDir)) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      } catch (e) {}
    };

    // Attempt to clean up on normal exit
    process.on('exit', cleanup);
    
    // Attempt to clean up on interrupt
    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      cleanup();
      process.exit(0);
    });

    // Execute the ESM code via dynamic import!
    await import(pathToFileURL(mjsPath).href);

  } catch (err) {
    console.error('Execution Error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Unhandled error in sea-launch:', err);
    process.exit(1);
  });
}
