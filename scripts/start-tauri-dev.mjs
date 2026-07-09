import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm';

function quoteArg(arg) {
  if (!/[\s"]/u.test(arg)) {
    return arg;
  }
  return `"${String(arg).replace(/"/g, '\\"')}"`;
}

function startProcess(command, args, label, cwd) {
  const child = isWindows
    ? spawn([command, ...args].map(quoteArg).join(' '), {
        cwd,
        stdio: 'inherit',
        shell: true,
      })
    : spawn(command, args, {
        cwd,
        stdio: 'inherit',
        shell: false,
      });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    const reason = signal ? `${label} exited with signal ${signal}` : `${label} exited with code ${code ?? 0}`;
    console.error(reason);
    shutdown(typeof code === 'number' ? code : 1);
  });

  child.on('error', (error) => {
    if (shuttingDown) {
      return;
    }
    console.error(`${label} failed to start:`, error);
    shutdown(1);
  });

  return child;
}

let shuttingDown = false;
const children = [];

function shutdown(code) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
  setTimeout(() => process.exit(code), 100);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

children.push(
  startProcess(
    pnpmCommand,
    ['--filter', './ui', 'run', 'dev', '--', '--mode', 'tauri', '--host', '127.0.0.1', '--port', '1420', '--strictPort'],
    'Vite dev server',
    repoRoot,
  ),
);

children.push(
  startProcess(
    pnpmCommand,
    ['--filter', './tauri', 'run', 'dev', '--', '--config', 'tauri.dev.conf.toml'],
    'Tauri dev',
    repoRoot,
  ),
);
