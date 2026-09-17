const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const rootDir = path.resolve(__dirname, '..', '..');
const outDir = path.join(rootDir, 'vscode', 'out', 'vscode', 'src', 'vendor');
const outfile = path.join(outDir, 'markdown-them.cjs');
const yamlOutDir = path.join(rootDir, 'vscode', 'out', 'node_modules', 'yaml');
const yamlOutfile = path.join(yamlOutDir, 'index.js');

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

async function bundleYaml({ fsImpl = fs, esbuildImpl = esbuild, root = rootDir, outputDirectory = yamlOutDir, outputFile = yamlOutfile, logger = console } = {}) {
  fsImpl.mkdirSync(outputDirectory, { recursive: true });
  await esbuildImpl.build({
    stdin: {
      contents: "module.exports = require('yaml');",
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
  logger.log(`Bundled yaml runtime to ${relativePath}`);
  return outputFile;
}

async function bundleAll() {
  await bundleMarkdownThem();
  await bundleYaml();
}

if (require.main === module) {
  bundleAll().catch((error) => {
    console.error('Failed to bundle VS Code runtime dependencies:', error);
    process.exitCode = 1;
  });
}

module.exports = { rootDir, outDir, outfile, yamlOutDir, yamlOutfile, bundleMarkdownThem, bundleYaml, bundleAll };
