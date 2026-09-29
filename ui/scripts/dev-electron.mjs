import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(uiRoot, '..');
const electronRoot = join(workspaceRoot, 'electron');
const requireFromWorkspace = createRequire(join(workspaceRoot, 'package.json'));
const electronBinary = requireFromWorkspace('electron');
const electronArgs = process.argv.slice(2);
const backendDirs = ['core', 'fonts', 'git', 'perf', 'preload', 'render', 'search', 'update', 'window', 'workspace', 'youtube'];

await import('./build-export-runtime.mjs');
process.env.NODE_ENV = 'development';
const server = await createServer({
  root: uiRoot,
  mode: 'electron',
  server: { host: '127.0.0.1', port: 5173 },
});
await server.listen();
const address = server.httpServer.address();
const devServerUrl = `http://127.0.0.1:${address.port}/`;
server.printUrls();

server.watcher.add([
  join(electronRoot, 'main.js'),
  join(electronRoot, 'package.json'),
  ...backendDirs.map((name) => join(electronRoot, name)),
]);

let electronProcess;
let restartTimer;
let stopping = false;
let restarting = false;

function launchElectron() {
  if (stopping) return;
  electronProcess = spawn(electronBinary, [...electronArgs, electronRoot], {
    cwd: workspaceRoot,
    env: { ...process.env, MDN_DEV_SERVER_URL: devServerUrl },
    stdio: 'inherit',
  });
  electronProcess.once('exit', (code) => {
    electronProcess = undefined;
    if (restarting) {
      restarting = false;
      launchElectron();
    } else if (!stopping) {
      void stop(code ?? 0);
    }
  });
}

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(restartTimer);
  electronProcess?.kill();
  await server.close();
  process.exitCode = code;
}

function restartElectron() {
  if (stopping || restarting) return;
  restarting = true;
  console.log('[dev:electron] Backend changed; restarting Electron');
  if (electronProcess) electronProcess.kill();
  else {
    restarting = false;
    launchElectron();
  }
}

server.watcher.on('all', (event, changedPath) => {
  if (!['add', 'change', 'unlink'].includes(event)) return;
  const absolutePath = resolve(changedPath);
  if (absolutePath !== join(electronRoot, 'main.js')
    && absolutePath !== join(electronRoot, 'package.json')
    && !absolutePath.startsWith(`${electronRoot}${sep}`)) return;
  if (absolutePath.includes(`${sep}node_modules${sep}`) || absolutePath.includes(`${sep}dist${sep}`)) return;
  if (!/\.(?:js|json)$/.test(absolutePath)) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(restartElectron, 120);
});

process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
launchElectron();
