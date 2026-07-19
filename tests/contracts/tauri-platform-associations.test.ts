import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');

function readConfig(name: string) {
  return JSON.parse(readFileSync(resolve(root, `tauri/${name}`), 'utf8'));
}

describe('Tauri native file and folder associations', () => {
  test('registers Markdown files and folders with macOS Finder', () => {
    const baseConfig = readConfig('tauri.conf.json');
    const config = readConfig('tauri.macos.conf.json');
    const associations = config.bundle.fileAssociations;

    expect(baseConfig.bundle.icon).toContain('icons/icon.icns');
    expect(associations[0]).toMatchObject({
      ext: ['md', 'mdx'],
      name: 'Markdown Document',
      role: 'Editor',
      rank: 'Alternate',
      mimeType: 'text/markdown',
    });
    expect(associations[1]).toMatchObject({
      ext: [],
      contentTypes: ['public.folder'],
      name: 'Folder',
      role: 'Editor',
      rank: 'Alternate',
    });
  });

  test('registers Markdown files and directories with Linux desktop environments', () => {
    const config = readConfig('tauri.linux.conf.json');
    const associations = config.bundle.fileAssociations;
    const desktopTemplate = readFileSync(resolve(root, 'tauri/linux/markdown-explorer.desktop'), 'utf8');

    expect(associations[0]).toMatchObject({ ext: ['md', 'mdx'], mimeType: 'text/markdown' });
    expect(associations[1]).toMatchObject({ ext: [], mimeType: 'inode/directory' });
    expect(config.bundle.linux.deb.desktopTemplate).toBe('./linux/markdown-explorer.desktop');
    expect(desktopTemplate).toContain('Exec={{exec}} %F');
    expect(desktopTemplate).toContain('MimeType={{mime_type}}');
  });

  test('handles Finder Open events in the running Tauri app', () => {
    const bootstrap = readFileSync(resolve(root, 'tauri/src/core/bootstrap.rs'), 'utf8');
    expect(bootstrap).toContain('tauri::RunEvent::Opened');
    expect(bootstrap).toContain('to_file_path()');
  });
});
