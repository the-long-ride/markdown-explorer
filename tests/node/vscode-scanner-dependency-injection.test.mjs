import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_WORKSPACE_EXCLUDE_PATTERNS,
  WORKSPACE_SCAN_BATCH_SIZE,
  WORKSPACE_SCAN_REVEAL_DELAY_MS,
  WORKSPACE_SCAN_PROGRESS_BATCH_SIZE,
  WORKSPACE_TITLE_CHUNK_BYTES,
} from '../../vscode/src/constants/workspace.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function compileScanner() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-explorer-scanner-'));
  const tscJsPath = path.join(repoRoot, 'node_modules/typescript/bin/tsc');
  const tscCmd = fs.existsSync(tscJsPath) ? process.execPath : 'tsc';
  const tscArgs = fs.existsSync(tscJsPath) ? [tscJsPath] : [];
  execFileSync(tscCmd, [
    ...tscArgs,
    '--noCheck',
    '--skipLibCheck',
    '--module', 'commonjs',
    '--target', 'es2020',
    '--esModuleInterop',
    '--rootDir', repoRoot,
    '--outDir', outDir,
    path.join(repoRoot, 'vscode/src/core/scanner.ts'),
    path.join(repoRoot, 'vscode/src/core/documentConversion.ts'),
    path.join(repoRoot, 'vscode/src/types.ts'),
  ], { cwd: repoRoot, stdio: 'pipe' });
  return { outDir, scannerPath: path.join(outDir, 'vscode/src/core/scanner.js') };
}

test('VS Code workspace constants match the active limits catalog', () => {
  assert.equal(WORKSPACE_SCAN_REVEAL_DELAY_MS, 3000);
  assert.equal(WORKSPACE_SCAN_BATCH_SIZE, 32);
  assert.equal(WORKSPACE_SCAN_PROGRESS_BATCH_SIZE, 100);
  assert.equal(WORKSPACE_TITLE_CHUNK_BYTES, 8 * 1024);
  assert.deepEqual(DEFAULT_WORKSPACE_EXCLUDE_PATTERNS, ['**/node_modules/**', '**/.git/**']);
});

test('WorkspaceScanner accepts an explicit context without exposing test-only mutation', async (t) => {
  const { outDir, scannerPath } = compileScanner();
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const require = createRequire(import.meta.url);
  const scannerModule = require(scannerPath);

  assert.equal(scannerModule.setWorkspaceContextForTest, undefined);

  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-explorer-workspace-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const diskPath = path.join(rootDir, 'guide.md');
  fs.writeFileSync(diskPath, '# Disk title', 'utf8');

  const context = {
    workspaceFolders: [{ uri: { fsPath: rootDir } }],
    getConfiguration() {
      return { get() { return undefined; } };
    },
    async findFiles() {
      return [{ fsPath: diskPath }];
    },
    textDocuments: [{ fileName: diskPath, getText: () => '# Editor title' }],
  };

  const discovered = [];
  const result = await scannerModule.WorkspaceScanner.scan(
    false,
    () => {},
    (file, count) => discovered.push([file.title, count]),
    context,
  );

  assert.deepEqual(discovered, [['Editor title', 1]]);
  assert.equal(result.flat[0].title, 'Editor title');
  assert.equal(scannerModule.WorkspaceScanner.readFile(diskPath, context), '# Editor title');
});
