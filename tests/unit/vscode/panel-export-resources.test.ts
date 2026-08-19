import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import {
  listPanelExportResources,
  readPanelExportResource,
} from '../../../vscode/src/core/panelExportResources';

const roots: string[] = [];

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
  it('lists regular files recursively, omits .git, and sorts paths', () => {
    const ws = workspace();
    ws.write('README.md', '# Docs');
    ws.write('assets/logo.png', new Uint8Array([1, 2, 3]));
    ws.write('examples/demo.json', '{"ok":true}');
    ws.write('.git/config', '[core]');

    const result = listPanelExportResources(ws.root);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const paths = result.resources.map((item) => item.relativePath);
    expect(new Set(paths)).toEqual(new Set(['README.md', 'assets/logo.png', 'examples/demo.json']));
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
    expect(result.resources.find((item) => item.relativePath === 'assets/logo.png')?.size).toBe(3);
  });

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
});
