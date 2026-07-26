import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getShellLocationLabel,
  requestShellLocation,
  resolveWorkspaceFolderPath,
  supportsShellLocation,
} from '../../ui/src/desktop/shellLocation.ts';

const translations = {
  tabContextMenu: {
    showInFileExplorer: 'Show in File Explorer',
    openInFinder: 'Open in Finder',
    revealInFinder: 'Reveal in Finder',
    showInFileManager: 'Show in File Manager',
  },
};

test('shell-location actions are available only in desktop runtimes', () => {
  assert.equal(supportsShellLocation('desktop'), true);
  assert.equal(supportsShellLocation('tauri'), true);
  assert.equal(supportsShellLocation('chrome'), false);
  assert.equal(supportsShellLocation('vscode'), false);
});

test('shell-location labels follow native platform terminology', () => {
  assert.equal(getShellLocationLabel(translations, 'windows', 'file'), 'Show in File Explorer');
  assert.equal(getShellLocationLabel(translations, 'windows', 'folder'), 'Show in File Explorer');
  assert.equal(getShellLocationLabel(translations, 'macos', 'file'), 'Reveal in Finder');
  assert.equal(getShellLocationLabel(translations, 'macos', 'folder'), 'Open in Finder');
  assert.equal(getShellLocationLabel(translations, 'linux', 'file'), 'Show in File Manager');
  assert.equal(getShellLocationLabel(translations, 'unknown', 'folder'), 'Show in File Manager');
});

test('shell-location requests preserve each native action mode', () => {
  const messages = [];
  const bridge = { postMessage: (message) => messages.push(message) };

  requestShellLocation(bridge, '/workspace', 'open-directory');
  requestShellLocation(bridge, '/workspace/readme.md', 'reveal-file');
  requestShellLocation(bridge, '/workspace/readme.md', 'open-parent-directory');
  requestShellLocation(bridge, '', 'open-directory');

  assert.deepEqual(messages, [
    { command: 'openShellLocation', path: '/workspace', mode: 'open-directory' },
    { command: 'openShellLocation', path: '/workspace/readme.md', mode: 'reveal-file' },
    { command: 'openShellLocation', path: '/workspace/readme.md', mode: 'open-parent-directory' },
  ]);
});

test('workspace folder paths resolve relative tree paths against the active workspace', () => {
  assert.equal(resolveWorkspaceFolderPath('/home/ophelia/project', 'docs/guides', 'linux'), '/home/ophelia/project/docs/guides');
  assert.equal(resolveWorkspaceFolderPath('C:\\Users\\Ophelia\\project', 'docs/guides', 'windows'), 'C:\\Users\\Ophelia\\project\\docs\\guides');
  assert.equal(resolveWorkspaceFolderPath('/home/ophelia/project/', '', 'linux'), '/home/ophelia/project');
});
