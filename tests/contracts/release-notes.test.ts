import { expect, test } from 'vitest';
import { renderReleaseNotes } from '../../.github/scripts/release-notes.mjs';

test('groups every asset and emits direct encoded links', () => {
  const notes = renderReleaseNotes({
    tag: 'v1.6.0',
    serverUrl: 'https://github.com',
    repository: 'the-long-ride/markdown-explorer',
    assets: [
      'electron-Markdown.Explorer.Setup.exe',
      'tauri-MarkdownExplorer.dmg',
      'electron-MarkdownExplorer.AppImage',
      'markdown-explorer-1.6.0.vsix',
      'markdown-explorer-chromium.zip',
    ],
  });

  expect(notes).toContain('### Windows');
  expect(notes).toContain('### macOS');
  expect(notes).toContain('### Linux');
  expect(notes).toContain('### VS Code Extension');
  expect(notes).toContain('### Chromium Extension');
  expect(notes).toContain('| Name | Download | Description |');
  expect(notes).toContain('electron-Markdown.Explorer.Setup.exe');
  expect(notes).not.toContain('%20');
  expect(notes).toContain('Electron desktop installer for Windows.');
  expect(notes).toContain(
    '[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer)',
  );
  expect(notes).toContain(
    '[Open VSX](https://open-vsx.org/extension/the-long-ride/vscode-extension-markdown-explorer)',
  );
  expect(notes).toContain(
    '[Project website](https://the-long-ride.github.io/markdown-explorer/)',
  );
  expect(notes).toContain(
    '[Markdown Explorer Change Logs](https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md)',
  );
  expect(notes.indexOf('VS Code Marketplace')).toBeLessThan(
    notes.indexOf('### Windows'),
  );
});

test('rejects empty release assets', () => {
  expect(() =>
    renderReleaseNotes({
      tag: 'v1.6.0',
      serverUrl: 'https://github.com',
      repository: 'owner/repo',
      assets: [],
    }),
  ).toThrow('No release assets found');
});

test('rejects asset names GitHub would rewrite', () => {
  expect(() =>
    renderReleaseNotes({
      tag: 'v1.6.0',
      serverUrl: 'https://github.com',
      repository: 'owner/repo',
      assets: ['electron-Markdown Explorer Setup.exe'],
    }),
  ).toThrow('Release asset names must not contain whitespace');
});
