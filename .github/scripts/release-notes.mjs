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

function normalizeAsset(asset) {
  if (typeof asset === 'string') return { name: asset, size: 0 };
  if (!asset || typeof asset.name !== 'string') {
    throw new Error('Release asset must be a string or { name, size } object');
  }
  const size = Number(asset.size);
  return {
    name: asset.name,
    size: Number.isFinite(size) && size > 0 ? size : 0,
  };
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const decimals = i === 0 ? 0 : value < 10 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

function classifyAsset(name) {
  const lower = name.toLowerCase();

  if (lower.endsWith('.vsix')) return 'VS Code Extension';
  if (lower.includes('chromium') && lower.endsWith('.zip')) {
    return 'Chromium Extension';
  }
  if (lower.endsWith('.exe')) return 'Windows';
  if (lower.endsWith('.dmg') || lower.endsWith('.zip')) return 'macOS';
  if (lower.endsWith('.deb') || lower.endsWith('.appimage')) return 'Linux';
  return 'Other';
}

function describeAsset(name, platform) {
  const lower = name.toLowerCase();
  const runtime = lower.startsWith('electron-')
    ? 'Electron desktop'
    : lower.startsWith('tauri-')
      ? 'Tauri desktop'
      : '';

  if (platform === 'VS Code Extension') return 'VS Code extension package.';
  if (platform === 'Chromium Extension') return 'Chromium extension package.';
  if (platform === 'Windows') {
    return lower.includes('setup')
      ? `${runtime || 'Desktop'} installer for Windows.`
      : `${runtime || 'Desktop'} portable executable for Windows.`;
  }
  if (platform === 'macOS') {
    return lower.endsWith('.dmg')
      ? `${runtime || 'Desktop'} disk image for macOS.`
      : `${runtime || 'Desktop'} archive for macOS.`;
  }
  if (platform === 'Linux') {
    return lower.endsWith('.deb')
      ? `${runtime || 'Desktop'} Debian package for Linux.`
      : `${runtime || 'Desktop'} portable AppImage for Linux.`;
  }
  return 'Release asset.';
}

function escapeCell(value) {
  return value.replaceAll('|', '\\|');
}

export function renderReleaseNotes({ tag, serverUrl, repository, assets }) {
  const normalized = assets.map(normalizeAsset);
  if (!normalized.length) throw new Error('No release assets found');
  if (normalized.some((asset) => /\s/.test(asset.name))) {
    throw new Error('Release asset names must not contain whitespace');
  }

  const grouped = Object.fromEntries(platforms.map((platform) => [platform, []]));
  for (const asset of normalized) grouped[classifyAsset(asset.name)].push(asset);

  const baseUrl = `${serverUrl.replace(/\/$/, '')}/${repository}/releases/download/${tag}`;
  const sections = platforms.flatMap((platform) => {
    const platformAssets = grouped[platform].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    if (!platformAssets.length) return [];

    const rows = platformAssets.map((asset) => {
      const url = `${baseUrl}/${encodeURIComponent(asset.name)}`;
      return `| ${escapeCell(asset.name)} | [Download](${url}) | ${formatSize(asset.size)} | ${describeAsset(asset.name, platform)} |`;
    });

    return [
      `### ${platform}`,
      '',
      '| Name | Download | Size | Description |',
      '| --- | --- | --- | --- |',
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
    .map((entry) => ({
      name: entry.name,
      size: fs.statSync(path.join(assetsDir, entry.name)).size,
    }));
  const notes = renderReleaseNotes({ tag, serverUrl, repository, assets });
  fs.writeFileSync(path.resolve('release-notes.md'), notes);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
