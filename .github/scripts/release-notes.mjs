import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const platforms = [
  'Windows',
  'macOS',
  'Linux',
  'VS Code Extension',
  'Chromium Extension',
  'Other',
];

const releasePreamble = [
  '[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer)',
  '[Open VSX](https://open-vsx.org/extension/the-long-ride/vscode-extension-markdown-explorer)',
  '[Project website](https://the-long-ride.github.io/markdown-explorer/)',
  '[Markdown Explorer Change Logs](https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md)',
].join('\n');

function classifyAsset(asset) {
  const name = asset.toLowerCase();

  if (name.endsWith('.vsix')) return 'VS Code Extension';
  if (name.includes('chromium') && name.endsWith('.zip')) {
    return 'Chromium Extension';
  }
  if (name.endsWith('.exe')) return 'Windows';
  if (name.endsWith('.dmg') || name.endsWith('.zip')) return 'macOS';
  if (name.endsWith('.deb') || name.endsWith('.appimage')) return 'Linux';
  return 'Other';
}

function describeAsset(asset, platform) {
  const name = asset.toLowerCase();
  const runtime = name.startsWith('electron-')
    ? 'Electron desktop'
    : name.startsWith('tauri-')
      ? 'Tauri desktop'
      : '';

  if (platform === 'VS Code Extension') return 'VS Code extension package.';
  if (platform === 'Chromium Extension') return 'Chromium extension package.';
  if (platform === 'Windows') return `${runtime || 'Desktop'} installer for Windows.`;
  if (platform === 'macOS') {
    return name.endsWith('.dmg')
      ? `${runtime || 'Desktop'} disk image for macOS.`
      : `${runtime || 'Desktop'} archive for macOS.`;
  }
  if (platform === 'Linux') {
    return name.endsWith('.deb')
      ? `${runtime || 'Desktop'} Debian package for Linux.`
      : `${runtime || 'Desktop'} AppImage for Linux.`;
  }
  return 'Release asset.';
}

function escapeCell(value) {
  return value.replaceAll('|', '\\|');
}

export function renderReleaseNotes({ tag, serverUrl, repository, assets }) {
  if (!assets.length) throw new Error('No release assets found');
  if (assets.some((asset) => /\s/.test(asset))) {
    throw new Error('Release asset names must not contain whitespace');
  }

  const grouped = Object.fromEntries(platforms.map((platform) => [platform, []]));
  for (const asset of assets) grouped[classifyAsset(asset)].push(asset);

  const baseUrl = `${serverUrl.replace(/\/$/, '')}/${repository}/releases/download/${tag}`;
  const sections = platforms.flatMap((platform) => {
    const platformAssets = grouped[platform].sort((left, right) =>
      left.localeCompare(right),
    );
    if (!platformAssets.length) return [];

    const rows = platformAssets.map((asset) => {
      const url = `${baseUrl}/${encodeURIComponent(asset)}`;
      return `| ${escapeCell(asset)} | [Download](${url}) | ${describeAsset(asset, platform)} |`;
    });

    return [
      `### ${platform}`,
      '',
      '| Name | Download | Description |',
      '| --- | --- | --- |',
      ...rows,
    ];
  });

  return `${releasePreamble}\n\n${sections.join('\n')}\n`;
}

function main() {
  const { RELEASE_TAG: tag, GITHUB_SERVER_URL: serverUrl, GITHUB_REPOSITORY: repository, RELEASE_ASSETS_DIR: assetsDir } = process.env;
  const assets = fs
    .readdirSync(assetsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const notes = renderReleaseNotes({ tag, serverUrl, repository, assets });
  fs.writeFileSync(path.resolve('release-notes.md'), notes);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
