import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createExportResourceHandlers } = require('../../../electron/core/runtime-export-resources.js');

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'mdn-export-resources-'));
  roots.push(root);
  const write = (path: string, data: string | Uint8Array) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    return target;
  };
  return { root, write };
}

function isSameOrInsidePath(base: string, target: string, pathApi: typeof import('node:path')) {
  const rel = pathApi.relative(pathApi.resolve(base), pathApi.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !pathApi.isAbsolute(rel));
}

function harness(root: string) {
  const sent: any[] = [];
  const handlers = createExportResourceHandlers({
    fs: require('node:fs'),
    pathApi: require('node:path'),
    sendHostMessage: (message: any) => sent.push(message),
    isSameOrInsidePath,
    getWorkspaceBaseDir: () => root,
  });
  return { sent, handlers };
}

describe('Electron export resource handlers', () => {
  it('recursively lists regular workspace files while omitting .git', () => {
    const ws = workspace();
    ws.write('README.md', '# Docs');
    ws.write('assets/logo.png', new Uint8Array([1, 2, 3]));
    ws.write('examples/demo.json', '{"ok":true}');
    ws.write('.git/config', '[core]');
    const { sent, handlers } = harness(ws.root);

    handlers.listWorkspaceExportResources({ requestId: 'list-1' });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      command: 'workspaceExportResourcesResult',
      requestId: 'list-1',
      ok: true,
    });
    const paths = sent[0].resources.map((item: any) => item.relativePath);
    expect(new Set(paths)).toEqual(new Set([
      'README.md',
      'assets/logo.png',
      'examples/demo.json',
    ]));
    expect(paths).toEqual([...paths].sort((a: string, b: string) => a.localeCompare(b)));
    expect(sent[0].resources.find((item: any) => item.relativePath === 'assets/logo.png').size).toBe(3);
  });

  it('reads binary document-relative assets and returns MIME plus base64', () => {
    const ws = workspace();
    const documentPath = ws.write('docs/readme.md', '# Readme');
    ws.write('assets/logo.png', new Uint8Array([1, 2, 3, 255]));
    const { sent, handlers } = harness(ws.root);

    handlers.readWorkspaceExportResource({
      requestId: 'read-1',
      documentPath,
      resourcePath: '../assets/logo.png',
    });

    expect(sent[0]).toEqual({
      command: 'workspaceExportResourceResult',
      requestId: 'read-1',
      ok: true,
      relativePath: 'assets/logo.png',
      mimeType: 'image/png',
      dataBase64: 'AQID/w==',
    });
  });

  it('rejects absolute and traversal targets outside the workspace', () => {
    const ws = workspace();
    const outside = mkdtempSync(join(tmpdir(), 'mdn-export-outside-'));
    roots.push(outside);
    const outsideFile = join(outside, 'secret.txt');
    writeFileSync(outsideFile, 'secret');
    const documentPath = ws.write('docs/readme.md', '# Readme');
    const { sent, handlers } = harness(ws.root);

    handlers.readWorkspaceExportResource({ requestId: 'absolute', resourcePath: outsideFile });
    handlers.readWorkspaceExportResource({
      requestId: 'traversal',
      documentPath,
      resourcePath: relative(dirname(documentPath), outsideFile),
    });

    expect(sent.map((message) => ({ requestId: message.requestId, ok: message.ok, reason: message.reason }))).toEqual([
      { requestId: 'absolute', ok: false, reason: 'outside-workspace' },
      { requestId: 'traversal', ok: false, reason: 'outside-workspace' },
    ]);
  });

  it('rejects symlink escapes after canonical resolution', () => {
    const ws = workspace();
    const outside = mkdtempSync(join(tmpdir(), 'mdn-export-symlink-outside-'));
    roots.push(outside);
    const outsideFile = join(outside, 'secret.bin');
    writeFileSync(outsideFile, 'secret');
    const link = join(ws.root, 'assets', 'secret.bin');
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(outsideFile, link);
    const { sent, handlers } = harness(ws.root);

    handlers.readWorkspaceExportResource({ requestId: 'link', resourcePath: 'assets/secret.bin' });

    expect(sent[0]).toMatchObject({
      command: 'workspaceExportResourceResult',
      requestId: 'link',
      ok: false,
      reason: 'outside-workspace',
    });
  });

  it('returns missing for a contained resource that does not exist', () => {
    const ws = workspace();
    const { sent, handlers } = harness(ws.root);

    handlers.readWorkspaceExportResource({ requestId: 'missing', resourcePath: 'assets/missing.svg' });

    expect(sent[0]).toMatchObject({
      command: 'workspaceExportResourceResult',
      requestId: 'missing',
      ok: false,
      reason: 'missing',
    });
  });
});
