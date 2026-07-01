const fs = require('fs');
const path = require('path');

function copyDirRecursive(src, dest, fsApi) {
  const fss = fsApi || fs;
  if (!fss.existsSync(src)) return;
  const entries = fss.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, fss);
    } else {
      if (entry.name.endsWith('.ttf')) {
        continue;
      }
      if (!fss.existsSync(dest)) {
        fss.mkdirSync(dest, { recursive: true });
      }
      fss.copyFileSync(srcPath, destPath);
    }
  }
}

function main(fsApi) {
  const fss = fsApi || fs;
  const rootDir = path.resolve(__dirname, '..', '..');
  const uiDistSrc = path.join(rootDir, 'ui', 'dist');
  const uiAssetsSrc = path.join(rootDir, 'ui', 'assets');

  const vscodeUiDistDest = path.join(rootDir, 'vscode', 'ui', 'dist');
  const vscodeUiAssetsDest = path.join(rootDir, 'vscode', 'ui', 'assets');

  console.log('Copying UI build artifacts to VS Code extension folder...');
  try {
    if (fss.existsSync(vscodeUiDistDest)) {
      fss.rmSync(vscodeUiDistDest, { recursive: true, force: true });
    }
    if (fss.existsSync(vscodeUiAssetsDest)) {
      fss.rmSync(vscodeUiAssetsDest, { recursive: true, force: true });
    }

    copyDirRecursive(uiDistSrc, vscodeUiDistDest, fss);
    copyDirRecursive(uiAssetsSrc, vscodeUiAssetsDest, fss);
    console.log('UI artifacts copied successfully.');
  } catch (err) {
    console.error('Failed to copy UI artifacts:', err);
    process.exit(1);
  }
}

module.exports = { copyDirRecursive, main };

if (require.main === module) {
  main();
}
