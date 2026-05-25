const fs = require('fs');
const path = require('path');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      if (entry.name.endsWith('.ttf')) {
        continue;
      }
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
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
  if (fs.existsSync(vscodeUiDistDest)) {
    fs.rmSync(vscodeUiDistDest, { recursive: true, force: true });
  }
  if (fs.existsSync(vscodeUiAssetsDest)) {
    fs.rmSync(vscodeUiAssetsDest, { recursive: true, force: true });
  }

  copyDirRecursive(uiDistSrc, vscodeUiDistDest);
  copyDirRecursive(uiAssetsSrc, vscodeUiAssetsDest);
  console.log('UI artifacts copied successfully.');
} catch (err) {
  console.error('Failed to copy UI artifacts:', err);
  process.exit(1);
}
