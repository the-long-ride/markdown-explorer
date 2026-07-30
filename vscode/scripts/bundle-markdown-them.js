const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const rootDir = path.resolve(__dirname, '..', '..');
const outDir = path.join(rootDir, 'vscode', 'out', 'vscode', 'src', 'vendor');
const outfile = path.join(outDir, 'markdown-them.cjs');

async function bundleMarkdownThem({ fsImpl = fs, esbuildImpl = esbuild, root = rootDir, outputDirectory = outDir, outputFile = outfile, logger = console } = {}) {
  fsImpl.mkdirSync(outputDirectory, { recursive: true });
  await esbuildImpl.build({
    stdin: {
      contents: "module.exports = require('@the-long-ride/markdown-them');",
      resolveDir: root,
      loader: 'js',
    },
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    packages: 'bundle',
    logLevel: 'warning',
  });
  const relativePath = path.relative(root, outputFile).replace(/\\/g, '/');
  logger.log(`Bundled markdown-them runtime to ${relativePath}`);
  return outputFile;
}

if (require.main === module) {
  bundleMarkdownThem().catch((error) => {
    console.error('Failed to bundle markdown-them runtime:', error);
    process.exitCode = 1;
  });
}

module.exports = { rootDir, outDir, outfile, bundleMarkdownThem };
