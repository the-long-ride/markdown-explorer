import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  handlePanelExportResourceMessage, readPanelExportResource,
} from '../../../vscode/src/core/panelExportResources';

const roots: string[] = [];

// Windows without Developer Mode/admin cannot create symlinks (EPERM) —
// symlink-specific assertions are skipped instead of failing on the OS limit.
const canSymlink = (() => {
  try {
    const probe = join(mkdtempSync(join(tmpdir(), 'mdn-vscode-symlink-probe-')), 'probe');
    symlinkSync(__filename, probe);
    rmSync(probe);
    return true;
  } catch {
    return false;
  }
})();

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'mdn-vscode-export-'));
  roots.push(root);
  const write = (path: string, data: string | Uint8Array) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    return target;
  };
  return { root, write };
}

describe('VS Code export workspace resources', () => {
  it('reads document-relative binary resources with MIME and base64', () => {
    const ws = workspace();
    const documentPath = ws.write('docs/readme.md', '# Readme');
    ws.write('assets/logo.png', new Uint8Array([1, 2, 3, 255]));

    expect(readPanelExportResource({
      documentPath,
      resourcePath: '../assets/logo.png',
    }, ws.root, (value) => value)).toEqual({
      ok: true,
      relativePath: 'assets/logo.png',
      mimeType: 'image/png',
      dataBase64: 'AQID/w==',
    });
  });

  it('rejects traversal and symlink escapes', () => {
    const ws = workspace();
    const outside = mkdtempSync(join(tmpdir(), 'mdn-vscode-outside-'));
    roots.push(outside);
    const secret = join(outside, 'secret.txt');
    writeFileSync(secret, 'secret');
    const documentPath = ws.write('docs/readme.md', '# Readme');

    expect(readPanelExportResource({
      documentPath,
      resourcePath: relative(dirname(documentPath), secret),
    }, ws.root, (value) => value)).toEqual({ ok: false, reason: 'outside-workspace' });

    if (!canSymlink) return;

    const link = join(ws.root, 'assets', 'secret.txt');
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(secret, link);
    expect(readPanelExportResource({ resourcePath: 'assets/secret.txt' }, ws.root, (value) => value))
      .toEqual({ ok: false, reason: 'outside-workspace' });
  });

  it('returns missing for a contained missing file', () => {
    const ws = workspace();
    expect(readPanelExportResource({ resourcePath: 'assets/missing.svg' }, ws.root, (value) => value))
      .toEqual({ ok: false, reason: 'missing' });
  });

  it.each([
    ['avif', 'image/avif'], ['bmp', 'image/bmp'], ['CSS', 'text/css'], ['gif', 'image/gif'],
    ['htm', 'text/html'], ['html', 'text/html'], ['ico', 'image/x-icon'],
    ['jpeg', 'image/jpeg'], ['jpg', 'image/jpeg'], ['js', 'text/javascript'], ['mjs', 'text/javascript'],
    ['json', 'application/json'], ['mp3', 'audio/mpeg'], ['mp4', 'video/mp4'], ['ogg', 'audio/ogg'],
    ['otf', 'font/otf'], ['pdf', 'application/pdf'], ['svg', 'image/svg+xml'], ['ttf', 'font/ttf'],
    ['txt', 'text/plain'], ['wasm', 'application/wasm'], ['wav', 'audio/wav'], ['webm', 'video/webm'],
    ['webp', 'image/webp'], ['woff', 'font/woff'], ['woff2', 'font/woff2'], ['other', 'application/octet-stream'],
  ])('returns the portable export path and MIME type for .%s', (extension, mimeType) => {
    const ws = workspace();
    const name = `sample.${extension}`;
    ws.write(`assets/${name}`, 'abc');
    expect(readPanelExportResource({ resourcePath: ` /assets/${name}?v=1#anchor` }, ws.root, fileURLToPath))
      .toEqual({ ok: true, relativePath: `assets/${name}`, mimeType, dataBase64: 'YWJj' });
  });

  it('resolves a file URI beside a single-file workspace and enforces the size limit', () => {
    const ws = workspace();
    const doc = ws.write('doc.md', '# Document');
    const stylesheet = ws.write('style.css', 'body {}');
    const uri = pathToFileURL(stylesheet).href;
    expect(readPanelExportResource({ resourcePath: uri }, doc, fileURLToPath))
      .toMatchObject({ ok: true, relativePath: 'style.css', mimeType: 'text/css' });
    truncateSync(stylesheet, 128 * 1024 * 1024 + 1);
    expect(readPanelExportResource({ resourcePath: uri }, doc, fileURLToPath))
      .toEqual({ ok: false, reason: 'too-large' });
  });

  it('rejects non-local references, directories and unset workspaces', () => {
    const ws = workspace();
    ws.write('assets/a.png', '');
    for (const resourcePath of ['', '  ', '#target', 'https://example.test/a.png', 'data:image/png,foo', '//example.test/a.png', 'assets']) {
      expect(readPanelExportResource({ resourcePath }, ws.root, fileURLToPath))
        .toEqual({ ok: false, reason: 'unsupported' });
    }
    expect(readPanelExportResource({ resourcePath: 'assets/a.png' }, join(ws.root, 'missing'), fileURLToPath))
      .toEqual({ ok: false, reason: 'unsupported' });
  });

  it('returns the request ID in replies and ignores unrelated commands', async () => {
    const ws = workspace();
    ws.write('site.css', 'p {}');
    const respond = vi.fn(async () => true);
    await expect(handlePanelExportResourceMessage({ command: 'differentCommand' }, ws.root, fileURLToPath, respond)).resolves.toBe(false);
    expect(respond).not.toHaveBeenCalled();
    await expect(handlePanelExportResourceMessage({
      command: 'readWorkspaceExportResource', requestId: 'export', resourcePath: 'site.css',
    }, ws.root, fileURLToPath, respond)).resolves.toBe(true);
    expect(respond).toHaveBeenLastCalledWith({
      command: 'workspaceExportResourceResult', requestId: 'export', ok: true, relativePath: 'site.css',
      mimeType: 'text/css', dataBase64: 'cCB7fQ==',
    });
    await handlePanelExportResourceMessage({ command: 'readWorkspaceExportResource' }, ws.root, fileURLToPath, respond);
    expect(respond).toHaveBeenLastCalledWith({ command: 'workspaceExportResourceResult', requestId: '', ok: false, reason: 'unsupported' });
  });
});
