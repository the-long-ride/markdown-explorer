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
  expect(notes).toContain('| Name | Download | Size | Description |');
  expect(notes).toContain('| --- | --- | --- | --- |');
  expect(notes).toContain('electron-Markdown.Explorer.Setup.exe');
  expect(notes).not.toContain('%20');
  expect(notes).toContain('Electron desktop installer for Windows.');
  expect(notes).toContain('Tauri desktop disk image for macOS.');
  expect(notes).toContain('Electron desktop portable AppImage for Linux.');
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

test('Windows portable exe is described as portable, not installer', () => {
  const notes = renderReleaseNotes({
    tag: 'v1.6.0',
    serverUrl: 'https://github.com',
    repository: 'the-long-ride/markdown-explorer',
    assets: [
      'electron-Markdown.Explorer.exe',
      'electron-Markdown.Explorer.Setup.exe',
    ],
  });

  expect(notes).toContain('Electron desktop portable executable for Windows.');
  expect(notes).toContain('Electron desktop installer for Windows.');
});

test('renders asset sizes in human-readable form after the Download column', () => {
  const notes = renderReleaseNotes({
    tag: 'v1.6.0',
    serverUrl: 'https://github.com',
    repository: 'the-long-ride/markdown-explorer',
    assets: [
      { name: 'electron-Markdown.Explorer.Setup.exe', size: 95000000 },
      { name: 'electron-Tiny.exe', size: 512 },
      { name: 'electron-Decimal.exe', size: 1234567 },
      { name: 'electron-Unknown.exe', size: 0 },
    ],
  });

  const setupRow = notes
    .split('\n')
    .find((line) => line.includes('electron-Markdown.Explorer.Setup.exe'));
  expect(setupRow).toBeDefined();
  expect(setupRow).toMatch(/\| 91 MB \|/);

  const tinyRow = notes
    .split('\n')
    .find((line) => line.includes('electron-Tiny.exe'));
  expect(tinyRow).toMatch(/\| 512 B \|/);

  const decimalRow = notes
    .split('\n')
    .find((line) => line.includes('electron-Decimal.exe'));
  expect(decimalRow).toMatch(/\| 1\.2 MB \|/);

  const unknownRow = notes
    .split('\n')
    .find((line) => line.includes('electron-Unknown.exe'));
  expect(unknownRow).toMatch(/\| — \|/);
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
