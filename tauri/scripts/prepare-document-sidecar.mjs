import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultTauriDir = path.resolve(scriptDir, '..');
const defaultRepoRoot = path.resolve(defaultTauriDir, '..');
const defaultSidecarDir = path.join(
  defaultTauriDir,
  'sidecar',
  'mdthem-sidecar',
);
const defaultBinaryDir = path.join(defaultTauriDir, 'binaries');
const sidecarBinaryBaseName = 'markdown-them-node';

export function deployArguments(packageName, targetDirectory) {
  return [
    '--filter',
    packageName,
    '--prod',
    'deploy',
    '--legacy',
    targetDirectory,
  ];
}

export function resolveTargetTriple({
  env = process.env,
  spawn = spawnSync,
} = {}) {
  for (const key of [
    'TAURI_ENV_TARGET_TRIPLE',
    'CARGO_BUILD_TARGET',
    'TARGET',
  ]) {
    const value = env[key]?.trim();
    if (value) return value;
  }

  const result = spawn('rustc', ['--print', 'host-tuple'], {
    encoding: 'utf8',
    env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `rustc --print host-tuple failed with exit code ${String(result.status)}`,
    );
  }
  const targetTriple = String(result.stdout || '').trim();
  if (!targetTriple) {
    throw new Error('rustc did not return a target triple.');
  }
  return targetTriple;
}

function clearPreparedSidecars(binaryDirectory) {
  mkdirSync(binaryDirectory, { recursive: true });
  for (const entry of readdirSync(binaryDirectory)) {
    if (entry.startsWith(`${sidecarBinaryBaseName}-`)) {
      rmSync(path.join(binaryDirectory, entry), { force: true });
    }
  }
}

export function prepareDocumentSidecar({
  repoRootPath = defaultRepoRoot,
  sidecarDirectory = defaultSidecarDir,
  outputDirectory = path.join(sidecarDirectory, 'dist'),
  binaryDirectory = defaultBinaryDir,
  nodeExecutable = process.env.MARKDOWN_EXPLORER_NODE_RUNTIME || process.execPath,
  platform = process.platform,
  architecture = process.arch,
  nodeVersion = process.version,
  targetTriple,
  spawn = spawnSync,
} = {}) {
  const resolvedTargetTriple = targetTriple || resolveTargetTriple({ spawn });
  const packageJson = JSON.parse(
    readFileSync(path.join(sidecarDirectory, 'package.json'), 'utf8'),
  );
  const appDir = path.join(outputDirectory, 'app');
  const pnpm = platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });

  const result = spawn(
    pnpm,
    deployArguments(packageJson.name, appDir),
    { cwd: repoRootPath, stdio: 'inherit', env: process.env },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm deploy failed with exit code ${String(result.status)}`);
  }

  clearPreparedSidecars(binaryDirectory);
  const executableSuffix = resolvedTargetTriple.includes('windows') ? '.exe' : '';
  const sidecarBinaryPath = path.join(
    binaryDirectory,
    `${sidecarBinaryBaseName}-${resolvedTargetTriple}${executableSuffix}`,
  );
  copyFileSync(nodeExecutable, sidecarBinaryPath);
  if (!resolvedTargetTriple.includes('windows')) {
    chmodSync(sidecarBinaryPath, 0o755);
  }

  writeFileSync(
    path.join(outputDirectory, 'manifest.json'),
    `${JSON.stringify({
      converter: '@the-long-ride/markdown-them',
      converterVersion: packageJson.dependencies['@the-long-ride/markdown-them'],
      nodeVersion,
      platform,
      architecture,
      targetTriple: resolvedTargetTriple,
    }, null, 2)}\n`,
  );

  return { appDir, sidecarBinaryPath };
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryUrl) {
  const staged = prepareDocumentSidecar();
  process.stdout.write(
    `Prepared markdown-them app at ${path.dirname(staged.appDir)}\n`,
  );
  process.stdout.write(
    `Prepared Tauri sidecar binary at ${staged.sidecarBinaryPath}\n`,
  );
}
