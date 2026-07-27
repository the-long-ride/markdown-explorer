import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));

const converterPackage = '@the-long-ride/markdown-them';

test('all enabled document-conversion variants pin the same markdown-them version', () => {
  const versions = [
    json('electron/package.json').dependencies?.[converterPackage],
    json('vscode/package.json').dependencies?.[converterPackage],
    json('tauri/sidecar/mdthem-sidecar/package.json').dependencies?.[converterPackage],
  ];

  assert.deepEqual(versions, ['^1.3.1', '^1.3.1', '^1.3.1']);
});

test('Electron, VS Code, and the Tauri child process call generateMarkdown', () => {
  assert.match(read('electron/render/document-converter.js'), /\.generateMarkdown\(filePath\)/);
  assert.match(read('vscode/src/core/documentConversion.ts'), /\.generateMarkdown\(filePath\)/);
  assert.match(read('tauri/sidecar/mdthem-sidecar/index.mjs'), /generateMarkdown/);

  const tauriConverter = read('tauri/src/render/document_converter.rs');
  assert.match(tauriConverter, /sidecar::convert_file\(file_path\)/);
  assert.doesNotMatch(tauriConverter, /ext\s*==\s*"\.pptx"/);
  assert.doesNotMatch(tauriConverter, /render::pptx/);
  assert.doesNotMatch(read('tauri/src/render/mod.rs'), /pub mod pptx/);
});

test('Tauri packages a Node child-process runtime and markdown-them sidecar', () => {
  const tauriConfig = json('tauri/tauri.conf.json');
  assert.deepEqual(tauriConfig.build.beforeBuildCommand, {
    script: 'pnpm run prepare:document-sidecar',
    cwd: '.',
  });
  assert.deepEqual(tauriConfig.build.beforeDevCommand, {
    script: 'pnpm run prepare:document-sidecar',
    cwd: '.',
    wait: true,
  });
  assert.equal(
    tauriConfig.bundle.resources?.['sidecar/mdthem-sidecar/dist/'],
    'document-sidecar/',
  );
  assert.deepEqual(tauriConfig.bundle.externalBin, [
    'binaries/markdown-them-node',
  ]);

  const tauriPackage = json('tauri/package.json');
  assert.equal(
    tauriPackage.scripts?.['prepare:document-sidecar'],
    'node scripts/prepare-document-sidecar.mjs',
  );

  const prepareScript = read('tauri/scripts/prepare-document-sidecar.mjs');
  assert.match(prepareScript, /pnpm/);
  assert.match(prepareScript, /deploy/);
  assert.match(prepareScript, /process\.execPath/);
  assert.match(prepareScript, /targetTriple/);
  assert.match(prepareScript, /markdown-them-node/);
  assert.match(prepareScript, /document-sidecar|mdthem-sidecar/);

  const rustSidecar = read('tauri/src/render/sidecar.rs');
  assert.match(rustSidecar, /Command::new/);
  assert.match(rustSidecar, /document-sidecar/);
  assert.match(rustSidecar, /MARKDOWN_EXPLORER_DOCUMENT_SIDECAR_DIR/);
  assert.match(rustSidecar, /current_exe/);
  assert.match(rustSidecar, /markdown-them-node/);

  const bootstrap = read('tauri/src/core/bootstrap.rs');
  assert.match(bootstrap, /configure_resource_dir/);
});

test('Tauri no longer carries a native PPTX parser dependency', () => {
  const cargo = read('tauri/Cargo.toml');
  assert.doesNotMatch(cargo, /^quick-xml\s*=/m);
  assert.doesNotMatch(cargo, /^flate2\s*=/m);
  assert.doesNotMatch(cargo, /^zip\s*=/m);
  assert.equal(fs.existsSync(path.join(repoRoot, 'tauri/src/render/pptx.rs')), false);
});

test('Snap stages the same child-process sidecar and points Tauri at it', () => {
  const workflow = read('.github/workflows/publish-desktop-stores.yml');
  assert.match(workflow, /sidecar\/mdthem-sidecar\/dist/);
  assert.match(workflow, /snap\/local\/document-sidecar/);

  const snapcraft = read('snap/snapcraft.yaml');
  assert.match(snapcraft, /MARKDOWN_EXPLORER_DOCUMENT_SIDECAR_DIR/);
  assert.match(snapcraft, /document-sidecar/);
});
