import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, '..', '..');
const script = resolve(repoRoot, 'ui', 'scripts', 'build-export-runtime.mjs');
const files = ['core.js', 'html-preview.js', 'media.js', 'table.js', 'charts.js'];
const offlineNamespaceUris = ['http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink'];

function unexpectedNetworkUrls(code) {
  const withoutNamespaces = offlineNamespaceUris.reduce((result, uri) => result.split(uri).join(''), code);
  return [...new Set(withoutNamespaces.match(/https?:\/\/[^\s"'<>]+/gi) || [])].sort();
}

test('builds deterministic feature-specific offline export runtimes', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'mdn-export-runtime-'));
  try {
    await execFileAsync(process.execPath, [script, outDir], { cwd: repoRoot });
    const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.core.chartJs, false);
    assert.equal(manifest.core.mermaid, false);
    assert.equal(manifest.table.chartJs, false);
    assert.equal(manifest.charts.chartJs, true);
    assert.equal(manifest.charts.mermaid, false);

    for (const file of files) {
      const code = await readFile(join(outDir, file), 'utf8');
      assert.ok(code.length > 20, `${file} should contain runtime code`);
      assert.deepEqual(unexpectedNetworkUrls(code), [], `${file} must not contain network/CDN URLs`);
      assert.doesNotMatch(code, /(?:unpkg|jsdelivr|PlatformBridge)/i, `${file} must stay host/CDN independent`);
    }
    assert.match(await readFile(join(outDir, 'charts.js'), 'utf8'), /chart\.js-local/);

    const namesBefore = [...files, 'manifest.json'].sort();
    await execFileAsync(process.execPath, [script, outDir], { cwd: repoRoot });
    const namesAfter = [...files, 'manifest.json'].sort();
    assert.deepEqual(namesAfter, namesBefore);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
