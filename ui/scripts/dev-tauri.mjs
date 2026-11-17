import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { getTauriCacheDir } from '../../tauri/scripts/run-with-global-cache.mjs';

const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(uiRoot, '..');
const tauriRunner = join(workspaceRoot, 'tauri', 'scripts', 'run-with-global-cache.mjs');
const extraArgs = process.argv.slice(2);

/**
 * Writes a temporary Tauri config override pointing `build.devUrl` at the local Vite HMR server.
 */
export function writeTauriDevConfigOverride(devServerUrl, env = process.env) {
  const cacheDir = getTauriCacheDir(env);
  mkdirSync(cacheDir, { recursive: true });
  const configPath = join(cacheDir, 'dev-tauri.conf.json');
  writeFileSync(configPath, `${JSON.stringify({ build: { devUrl: devServerUrl } }, null, 2)}\n`, 'utf8');
  return configPath;
}

async function main() {
  await import('./build-export-runtime.mjs');
  process.env.NODE_ENV = 'development';

  const server = await createServer({
    root: uiRoot,
    mode: 'tauri',
    server: { host: '127.0.0.1', port: 5174 },
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5174;
  const devServerUrl = `http://127.0.0.1:${port}/`;
  server.printUrls();

  const devConfigPath = writeTauriDevConfigOverride(devServerUrl);
  let stopping = false;

  const tauriProcess = spawn(
    process.execPath,
    [tauriRunner, 'dev', '--config', devConfigPath, ...extraArgs],
    {
      cwd: workspaceRoot,
      env: process.env,
      stdio: 'inherit',
      shell: false,
    },
  );

  async function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    tauriProcess.kill();
    await server.close();
    process.exitCode = code;
  }

  tauriProcess.once('exit', (code) => {
    void stop(code ?? 0);
  });
  tauriProcess.once('error', (error) => {
    console.error('[dev:tauri] Failed to launch Tauri dev process:', error);
    void stop(1);
  });

  process.on('SIGINT', () => { void stop(0); });
  process.on('SIGTERM', () => { void stop(0); });
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  void main();
}
