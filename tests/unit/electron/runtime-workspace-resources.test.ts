import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createWorkspaceTextResourceReader } = require('../../../electron/core/runtime-workspace-resources.js');
const { isSameOrInsidePath } = require('../../../electron/core/runtime-utils.js');

const root = path.resolve('workspace');
const documentPath = path.join(root, 'docs', 'index.html');
const resource = path.join(root, 'theme.css');

function setup(base: string | null = root, pathApi = path) {
  const sendHostMessage = vi.fn();
  const fs = {
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ isFile: () => true })),
    realpathSync: vi.fn((target: string) => target),
    readFileSync: vi.fn(() => 'body {}'),
  };
  const read = createWorkspaceTextResourceReader({
    fs, pathApi, sendHostMessage, isSameOrInsidePath, getWorkspaceBaseDir: () => base,
  });
  return { read, fs, sendHostMessage };
}

describe('Electron workspace text resources', () => {
  test.each([
    ['/theme.css?v=1#style', resource],
    ['../theme.css', resource],
    [pathToFileURL(resource).href, resource.split(path.sep).join('/')],
  ])('reads contained text resource %s', (resourcePath, resolvedPath) => {
    const { read, fs, sendHostMessage } = setup();
    read({ requestId: 'read', documentPath, resourcePath });
    expect(fs.readFileSync).toHaveBeenCalledExactlyOnceWith(resolvedPath, 'utf8');
    expect(sendHostMessage).toHaveBeenCalledExactlyOnceWith({
      command: 'workspaceTextResourceResult', requestId: 'read', ok: true, content: 'body {}', resolvedPath,
    });
  });

  test.each(['C:\\workspace\\theme.css', 'file:///C:/workspace/theme.css'])('accepts absolute Windows resource %s', (resourcePath) => {
    const base = 'C:\\workspace';
    const { read, fs } = setup(base, path.win32);
    read({ requestId: 'read', documentPath: base + '\\docs\\index.html', resourcePath });
    expect(fs.readFileSync).toHaveBeenCalledExactlyOnceWith(
      resourcePath.startsWith('file:') ? 'C:/workspace/theme.css' : 'C:\\workspace\\theme.css', 'utf8',
    );
  });

  test.each([
    [undefined, 'unsupported', ''],
    [{ requestId: 'read' }, 'unsupported', 'read'],
    [{ requestId: 'read', documentPath }, 'unsupported', 'read'],
    [{ requestId: 'read', documentPath, resourcePath: '#fragment' }, 'unsupported', 'read'],
    [{ requestId: 'read', documentPath, resourcePath: 'https://example.test/style.css' }, 'unsupported', 'read'],
    [{ requestId: 'read', documentPath, resourcePath: '../../outside.js' }, 'outside-workspace', 'read'],
    [{ requestId: 'read', documentPath, resourcePath: 'index.html' }, 'outside-workspace', 'read'],
    [{ requestId: 'read', documentPath, resourcePath: 'file:///%XX.css' }, 'unreadable', 'read'],
  ])('rejects invalid resource request %j', (message, reason, requestId) => {
    const { read, fs, sendHostMessage } = setup();
    read(message);
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(sendHostMessage).toHaveBeenCalledExactlyOnceWith({ command: 'workspaceTextResourceResult', requestId, ok: false, reason });
  });

  test('does not resolve resources without an active workspace', () => {
    const { read, fs, sendHostMessage } = setup(null);
    read({ requestId: 'read', documentPath, resourcePath: '/theme.css' });
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(sendHostMessage).toHaveBeenCalledExactlyOnceWith({
      command: 'workspaceTextResourceResult', requestId: 'read', ok: false, reason: 'missing',
    });
  });

  test('rejects symlink escapes and distinguishes missing, non-file, and unreadable targets', () => {
    const { read, fs, sendHostMessage } = setup();
    fs.existsSync.mockReturnValueOnce(false);
    fs.statSync.mockReturnValueOnce({ isFile: () => false });
    fs.realpathSync.mockImplementationOnce(() => root).mockImplementationOnce(() => path.resolve('outside.css'));
    fs.realpathSync.mockImplementationOnce(() => { throw new Error('denied'); });
    for (const reason of ['missing', 'missing', 'outside-workspace', 'unreadable']) {
      read({ requestId: 'read', documentPath, resourcePath: '/theme.css' });
      expect(sendHostMessage).toHaveBeenLastCalledWith({ command: 'workspaceTextResourceResult', requestId: 'read', ok: false, reason });
    }
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });
});
