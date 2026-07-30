const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..');
const requiredRuntimeFiles = [
  path.join('out', 'vscode', 'src', 'extension.js'),
  path.join('out', 'vscode', 'src', 'vendor', 'markdown-them.cjs'),
  path.join('ui', 'dist', 'index.html'),
];

function findMissingRuntimeFiles({ fsImpl = fs, root = extensionRoot, requiredFiles = requiredRuntimeFiles } = {}) {
  return requiredFiles.filter((relativePath) => !fsImpl.existsSync(path.join(root, relativePath)));
}

function verifyPackageRuntime({ fsImpl = fs, root = extensionRoot, requiredFiles = requiredRuntimeFiles, logger = console } = {}) {
  const missingFiles = findMissingRuntimeFiles({ fsImpl, root, requiredFiles });
  if (missingFiles.length > 0) {
    logger.error('VSIX runtime verification failed. Missing packaged runtime files:');
    for (const relativePath of missingFiles) logger.error(`- ${relativePath}`);
    return { ok: false, missingFiles };
  }
  logger.log(`Verified ${requiredFiles.length} VSIX runtime files.`);
  return { ok: true, missingFiles: [] };
}

if (require.main === module) {
  const result = verifyPackageRuntime();
  if (!result.ok) process.exitCode = 1;
}

module.exports = { extensionRoot, requiredRuntimeFiles, findMissingRuntimeFiles, verifyPackageRuntime };
