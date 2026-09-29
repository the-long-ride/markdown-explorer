const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const extensionRoot = path.resolve(__dirname, '..');
const entryPoint = path.join(extensionRoot, 'out', 'vscode', 'src', 'extension.js');
// documentConversion resolves the prebuilt markdown-them runtime from ../vendor,
// so keep the bundle in core/ to preserve that runtime path.
const outfile = path.join(extensionRoot, 'out', 'vscode', 'src', 'core', 'extension.bundle.js');

async function bundleExtension({
  fsImpl = fs,
  esbuildImpl = esbuild,
  root = extensionRoot,
  logger = console,
} = {}) {
  const inputFile = path.join(root, 'out', 'vscode', 'src', 'extension.js');
  const outputFile = path.join(root, 'out', 'vscode', 'src', 'core', 'extension.bundle.js');

  if (!fsImpl.existsSync(inputFile)) {
    throw new Error(`Cannot bundle VS Code extension before TypeScript compilation: ${inputFile}`);
  }

  await esbuildImpl.build({
    entryPoints: [inputFile],
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['vscode', '@the-long-ride/markdown-them', 'yaml'],
    packages: 'bundle',
    sourcemap: false,
    logLevel: 'warning',
  });

  const relativePath = path.relative(root, outputFile).replace(/\\/g, '/');
  logger.log(`Bundled VS Code extension runtime to ${relativePath}`);
  return outputFile;
}

if (require.main === module) {
  bundleExtension().catch((error) => {
    console.error('Failed to bundle VS Code extension runtime:', error);
    process.exitCode = 1;
  });
}

module.exports = { extensionRoot, entryPoint, outfile, bundleExtension };
