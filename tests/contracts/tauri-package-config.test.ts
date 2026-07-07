import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const pkg = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
);
const workspace = fs.readFileSync(
  path.join(repoRoot, 'pnpm-workspace.yaml'),
  'utf8',
);

describe('tauri package config', () => {
  test('root package exposes start:tauri script', () => {
    expect(pkg.scripts['start:tauri']).toContain('build:ui:electron');
    expect(pkg.scripts['start:tauri']).toContain('tauri');
  });

  test('root package exposes build:tauri script', () => {
    expect(pkg.scripts['build:tauri']).toContain('build:ui:electron');
    expect(pkg.scripts['build:tauri']).toContain('tauri');
  });

  test('root package exposes test:tauri script', () => {
    expect(pkg.scripts['test:tauri']).toBe(
      'cargo test --manifest-path tauri/Cargo.toml -- --test-threads=1',
    );
  });

  test('root package exposes test:desktop script', () => {
    expect(pkg.scripts['test:desktop']).toContain('test:electron');
    expect(pkg.scripts['test:desktop']).toContain('test:tauri');
  });

  test('pnpm workspace includes tauri', () => {
    expect(workspace).toContain('- tauri');
  });

  test('pnpm workspace includes sidecar', () => {
    expect(workspace).toContain('tauri/sidecar/mdthem-sidecar');
  });

  test('tauri Cargo.toml exists', () => {
    expect(
      fs.existsSync(path.join(repoRoot, 'tauri/Cargo.toml')),
    ).toBe(true);
  });

  test('tauri build script lets Tauri own Windows manifest embedding', () => {
    const buildScript = fs.readFileSync(
      path.join(repoRoot, 'tauri/build.rs'),
      'utf8',
    );
    expect(buildScript).not.toContain('MANIFESTINPUT');
    expect(buildScript).not.toContain('MANIFEST:EMBED');
  });

  test('tauri tauri.conf.json exists', () => {
    expect(
      fs.existsSync(path.join(repoRoot, 'tauri/tauri.conf.json')),
    ).toBe(true);
  });

  test('tauri.conf.json enables withGlobalTauri', () => {
    const conf = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tauri/tauri.conf.json'), 'utf8'),
    );
    expect(conf.app?.withGlobalTauri).toBe(true);
  });

  test('tauri.conf.json has empty windows array (window created programmatically)', () => {
    const conf = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tauri/tauri.conf.json'), 'utf8'),
    );
    expect(conf.app?.windows).toEqual([]);
  });

  test('capabilities include core:event:allow-emit for frontend→backend events', () => {
    const caps = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tauri/capabilities/default.json'), 'utf8'),
    );
    expect(caps.permissions).toContain('core:event:allow-emit');
    expect(caps.permissions).toContain('core:event:allow-listen');
  });

  test('bootstrap uses initialization_script (not eval) for shim injection', () => {
    const bootstrap = fs.readFileSync(
      path.join(repoRoot, 'tauri/src/core/bootstrap.rs'),
      'utf8',
    );
    expect(bootstrap).toContain('initialization_script');
    expect(bootstrap).toContain('decorations(false)');
    expect(bootstrap).toContain('WebviewWindowBuilder');
  });

  test('preload shim retries when __TAURI__ is not ready', () => {
    const api = fs.readFileSync(
      path.join(repoRoot, 'tauri/src/preload/api.rs'),
      'utf8',
    );
    expect(api).toContain('setTimeout(ensureHostListener');
    expect(api).toContain('__TAURI__');
  });

  test('preload shim converts file:/// URLs to local-file:// via MutationObserver', () => {
    const api = fs.readFileSync(
      path.join(repoRoot, 'tauri/src/preload/api.rs'),
      'utf8',
    );
    expect(api).toContain('fileSrcToAsset');
    expect(api).toContain('local-file://');
    expect(api).toContain('encodeURIComponent');
    expect(api).toContain('MutationObserver');
    expect(api).toContain('patchSrc');
    expect(api).toContain('startObserver');
    expect(api).toContain("startsWith('file:///')");
    expect(api).toContain('document.documentElement');
  });

  test('preload shim blocks native context menu', () => {
    const api = fs.readFileSync(
      path.join(repoRoot, 'tauri/src/preload/api.rs'),
      'utf8',
    );
    expect(api).toContain("addEventListener('contextmenu'");
    expect(api).toContain('e.preventDefault()');
  });

  test('logo imports use ?inline to force base64 inlining', () => {
    const components = [
      'ui/src/components/Topbar/Topbar.tsx',
      'ui/src/components/Desktop/DesktopTabBar.tsx',
      'ui/src/components/Workspace/WorkspaceSelection.tsx',
      'ui/src/components/Modal/TermsModal.tsx',
    ];
    for (const rel of components) {
      const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      expect(src).toContain("logo-500.png?inline");
    }
  });

  test('watcher filters ignored directories', () => {
    const watch = fs.readFileSync(
      path.join(repoRoot, 'tauri/src/workspace/watch.rs'),
      'utf8',
    );
    expect(watch).toContain('is_ignored_watch_path');
    expect(watch).toContain('IGNORED_DIRS');
    expect(watch).toContain('target');
    expect(watch).toContain('node_modules');
    expect(watch).toContain('.git');
  });
});
