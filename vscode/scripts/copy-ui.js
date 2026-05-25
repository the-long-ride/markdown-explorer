const fs = require('fs');
const path = require('path');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const rootDir = path.resolve(__dirname, '..', '..');
const uiDistSrc = path.join(rootDir, 'ui', 'dist');
const uiAssetsSrc = path.join(rootDir, 'ui', 'assets');

const vscodeUiDistDest = path.join(rootDir, 'vscode', 'ui', 'dist');
const vscodeUiAssetsDest = path.join(rootDir, 'vscode', 'ui', 'assets');

console.log('Copying UI build artifacts to VS Code extension folder...');
try {
  copyDirRecursive(uiDistSrc, vscodeUiDistDest);
  copyDirRecursive(uiAssetsSrc, vscodeUiAssetsDest);
  console.log('UI artifacts copied successfully.');
} catch (err) {
  console.error('Failed to copy UI artifacts:', err);
  process.exit(1);
}
