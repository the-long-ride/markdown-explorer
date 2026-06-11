const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const rootDir = path.resolve(__dirname, '..', '..');
const outDir = path.join(rootDir, 'vscode', 'out', 'vendor');
const outfile = path.join(outDir, 'markdown-them.cjs');

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  await esbuild.build({
    stdin: {
      contents: "module.exports = require('@the-long-ride/markdown-them');",
      resolveDir: rootDir,
      loader: 'js',
    },
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    packages: 'bundle',
    logLevel: 'warning',
  });
  console.log(`Bundled markdown-them runtime to ${path.relative(rootDir, outfile)}`);
}

main().catch((err) => {
  console.error('Failed to bundle markdown-them runtime:', err);
  process.exit(1);
});
