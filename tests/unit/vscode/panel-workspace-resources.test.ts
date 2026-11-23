import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readPanelWorkspaceTextResource } from '../../../vscode/src/core/panelWorkspaceResources';

let root: string;
let documentPath: string;
let style: string;
beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-text-resources-')));
  fs.mkdirSync(path.join(root, 'docs'));
  documentPath = path.join(root, 'docs', 'example.html');
  style = path.join(root, 'site.css');
  fs.writeFileSync(style, 'body { color: blue }');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

test('reads document-relative, root-relative and local URI resources without query strings or fragments', async () => {
  const respond = vi.fn(async () => true);
  for (const resourcePath of ['../site.css?v=3#rule', '/site.css', pathToFileURL(style).href]) {
    await readPanelWorkspaceTextResource({ requestId: 'style', documentPath, resourcePath }, root, fileURLToPath, respond);
    expect(respond).toHaveBeenLastCalledWith({ ok: true, content: 'body { color: blue }', resolvedPath: style });
  }
});

test('does not read unsupported, missing, directory or outside-workspace resources', async () => {
  const respond = vi.fn(async () => true);
  fs.mkdirSync(path.join(root, 'docs', 'directory.css'));
  for (const [resourcePath, reason] of [
    ['', 'unsupported'], ['#fragment', 'unsupported'], ['data:text/css,p{}', 'unsupported'],
    ['https://example.test/style.css', 'unsupported'], ['photo.png', 'outside-workspace'],
    ['../../outside.css', 'outside-workspace'], ['missing.css', 'missing'], ['directory.css', 'missing'],
  ]) {
    await readPanelWorkspaceTextResource({ requestId: 'asset', documentPath, resourcePath }, root, fileURLToPath, respond);
    expect(respond).toHaveBeenLastCalledWith({ ok: false, reason });
  }
  await readPanelWorkspaceTextResource({ requestId: 'asset', documentPath, resourcePath: 'site.css' }, undefined, fileURLToPath, respond);
  expect(respond).toHaveBeenLastCalledWith({ ok: false, reason: 'unsupported' });
  await readPanelWorkspaceTextResource({ requestId: 'asset', documentPath: '', resourcePath: 'site.css' }, root, fileURLToPath, respond);
  expect(respond).toHaveBeenLastCalledWith({ ok: false, reason: 'unsupported' });
});

test('reports malformed file URI reads as unreadable', async () => {
  const respond = vi.fn(async () => true);
  await readPanelWorkspaceTextResource({ requestId: 'style', documentPath, resourcePath: 'file:///%' }, root, fileURLToPath, respond);
  expect(respond).toHaveBeenCalledExactlyOnceWith({ ok: false, reason: 'unreadable' });
});
