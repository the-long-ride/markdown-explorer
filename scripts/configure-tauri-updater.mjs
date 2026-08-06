import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SENTINEL = '__TAURI_UPDATER_PUBLIC_KEY__';

export function normalizeUpdaterPublicKey(value) {
  const normalized = String(value ?? '').replaceAll('\\n', '\n').trim();
  const keyLine = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .findLast((line) => line && !line.startsWith('untrusted comment:'));
  if (!keyLine || !/^R[WU][A-Za-z0-9+/]{40,}={0,2}$/.test(keyLine)) {
    throw new Error('TAURI_UPDATER_PUBLIC_KEY must contain a valid minisign public key');
  }
  return normalized;
}

export function configureTauriUpdater({
  configPath = path.resolve('tauri/tauri.conf.json'),
  publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY,
} = {}) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configuredKey = normalizeUpdaterPublicKey(publicKey);
  const currentKey = config?.plugins?.updater?.pubkey;
  if (currentKey !== SENTINEL && currentKey !== configuredKey) {
    throw new Error(`Refusing to replace unexpected updater public key in ${configPath}`);
  }
  config.bundle ??= {};
  config.bundle.createUpdaterArtifacts = true;
  config.plugins ??= {};
  config.plugins.updater ??= {};
  config.plugins.updater.pubkey = configuredKey;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configuredKey;
}

function main() {
  const configPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve('tauri/tauri.conf.json');
  configureTauriUpdater({ configPath });
  console.log(`Configured signed Tauri updater: ${configPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
