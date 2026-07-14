import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const RUST_CHANNEL = '1.96.0';
const WINDOWS_GNU_TOOLCHAIN = `${RUST_CHANNEL}-x86_64-pc-windows-gnu`;

export function getTauriCacheDir(env = process.env) {
  if (env.MARKDOWN_EXPLORER_TAURI_CACHE) {
    return env.MARKDOWN_EXPLORER_TAURI_CACHE;
  }

  if (env.LOCALAPPDATA) {
    return path.join(env.LOCALAPPDATA, 'MarkdownExplorer', 'tauri-cache');
  }

  const cacheRoot = env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(cacheRoot, 'markdown-explorer', 'tauri-cache');
}

/**
 * True when the MSVC linker is available on PATH (required for *-windows-msvc).
 */
export function hasMsvcLinker(env = process.env, run = spawnSync) {
  if (env.MARKDOWN_EXPLORER_FORCE_GNU === '1') {
    return false;
  }

  if (env.MARKDOWN_EXPLORER_FORCE_MSVC === '1') {
    return true;
  }

  if (process.platform !== 'win32') {
    return true;
  }

  const result = run('where.exe', ['link.exe'], {
    encoding: 'utf8',
    env,
    shell: false,
    windowsHide: true,
  });

  return result.status === 0 && Boolean(result.stdout && String(result.stdout).trim());
}

/**
 * Prefer MSVC when link.exe is present; otherwise fall back to the GNU toolchain
 * so `pnpm run start:tauri` / F5 still works without a full VS C++ install.
 */
export function resolveCargoArgs(tauriArgs, env = process.env, options = {}) {
  const args = ['tauri', ...tauriArgs];
  const linkerOk = options.hasLinker ?? hasMsvcLinker(env, options.run ?? spawnSync);

  if (process.platform === 'win32' && !linkerOk) {
    return [`+${WINDOWS_GNU_TOOLCHAIN}`, ...args];
  }

  return args;
}

function main() {
  const cacheDir = getTauriCacheDir();
  const env = {
    ...process.env,
    CARGO_HOME: path.join(cacheDir, 'cargo-home'),
    CARGO_TARGET_DIR: path.join(cacheDir, 'target'),
  };

  fs.mkdirSync(cacheDir, { recursive: true });

  const cargoArgs = resolveCargoArgs(process.argv.slice(2), env);
  if (cargoArgs[0]?.startsWith('+')) {
    console.warn(
      `[tauri] MSVC linker (link.exe) not on PATH — using ${cargoArgs[0].slice(1)}. ` +
        'Install "Desktop development with C++" (VS Build Tools) for the default MSVC target, ' +
        'or set MARKDOWN_EXPLORER_FORCE_GNU=1 to silence this.',
    );
  }

  const cargoCommand = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
  const result = spawnSync(cargoCommand, cargoArgs, {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main();
}
