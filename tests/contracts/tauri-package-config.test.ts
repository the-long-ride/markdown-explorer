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
const releaseWorkflow = fs.readFileSync(
  path.join(repoRoot, '.github/workflows/release.yml'),
  'utf8',
);
const rustToolchain = fs.readFileSync(
  path.join(repoRoot, 'tauri/rust-toolchain.toml'),
  'utf8',
);

describe('tauri package config', () => {
  test('root package exposes start:tauri script', () => {
    expect(pkg.scripts['start:tauri']).toContain('build:ui:tauri');
    expect(pkg.scripts['start:tauri']).toContain('tauri');
  });

  test('root package exposes build:tauri script', () => {
    expect(pkg.scripts['build:tauri']).toContain('build:ui:tauri');
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


  test('tauri routes convertible documents through the in-process Rust converter', () => {
    const renderModules = fs.readFileSync(
      path.join(repoRoot, 'tauri/src/render/mod.rs'),
      'utf8',
    );
    const converter = fs.readFileSync(
      path.join(repoRoot, 'tauri/src/render/document_converter.rs'),
      'utf8',
    );
    const nativeConverter = fs.readFileSync(
      path.join(repoRoot, 'tauri/src/render/native_document_converter/mod.rs'),
      'utf8',
    );
    const conf = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tauri/tauri.conf.json'), 'utf8'),
    );
    const tauriPackage = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tauri/package.json'), 'utf8'),
    );

    expect(renderModules).toContain('pub mod native_document_converter;');
    expect(converter).toContain('native_document_converter::convert_file');
    expect(nativeConverter).toContain('pub enum ConversionQuality');
    expect(nativeConverter).toContain('BestEffortLegacy');
    expect(conf.bundle?.externalBin).toBeUndefined();
    expect(conf.bundle?.resources).toBeUndefined();
    expect(conf.build?.beforeBuildCommand).toBeUndefined();
    expect(conf.build?.beforeDevCommand).toBeUndefined();
    expect(tauriPackage.scripts['prepare:document-sidecar']).toBeUndefined();
    expect(workspace).not.toContain('mdthem-sidecar');
  });

  test('tauri Cargo.toml exists', () => {
    expect(
      fs.existsSync(path.join(repoRoot, 'tauri/Cargo.toml')),
    ).toBe(true);
  });

  test('pins glib to the patched VariantStrIter implementation', () => {
    const cargo = fs.readFileSync(path.join(repoRoot, 'tauri/Cargo.toml'), 'utf8');
    const variantIter = fs.readFileSync(
      path.join(repoRoot, 'tauri/vendor/glib/src/variant_iter.rs'),
      'utf8',
    );

    expect(cargo).toContain('[patch.crates-io]');
    expect(cargo).toContain('glib = { path = "vendor/glib" }');
    expect(variantIter).toContain('let mut p: *mut libc::c_char');
    expect(variantIter).toContain('&mut p');
    expect(variantIter).not.toContain('            &p,');
  });

  test('tauri rust toolchain channel does not include target triple', () => {
    const channel = rustToolchain.match(/^channel\s*=\s*"([^"]+)"/m)?.[1];
    expect(channel).toBeTruthy();
    expect(channel).not.toMatch(
      /-(?:x86_64|aarch64|i686|armv7)-[a-z0-9_]+-[a-z0-9_]+/,
    );
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

  test('tauri.conf.json declares branded bundle icons for desktop installers', () => {
    const conf = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'tauri/tauri.conf.json'), 'utf8'),
    );
    expect(conf.bundle?.icon).toEqual(
      expect.arrayContaining([
        'icons/icon.png',
        'icons/icon.ico',
        'icons/icon.icns',
      ]),
    );
  });

  test('tauri branded icon assets exist', () => {
    for (const rel of [
      'tauri/icons/icon.png',
      'tauri/icons/icon.ico',
      'tauri/icons/icon.icns',
    ]) {
      expect(fs.existsSync(path.join(repoRoot, rel))).toBe(true);
    }
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

  test('preload receives host messages through the native Rust bridge', () => {
    const api = fs.readFileSync(
      path.join(repoRoot, 'tauri/src/preload/api.rs'),
      'utf8',
    );
    expect(api).toContain('__markdownExplorerHandleHostMessage');
    expect(api).toContain('pendingHostMessages');
    expect(api).not.toContain('__TAURI__.event.listen');
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

  test('release workflow syncs tauri version from release tag', () => {
    expect(releaseWorkflow).toContain('Derive Tauri release version');
    expect(releaseWorkflow).toContain('TAURI_VERSION=${TAG_VALUE#v}');
    expect(releaseWorkflow).toContain("tauri/tauri.conf.json', 'tauri/package.json");
    expect(releaseWorkflow).toContain("Expected release tag like v1.2.3");
  });

  test('release workflow strips embedded versions from tauri asset names', () => {
    expect(releaseWorkflow).toContain('Rename Tauri artifacts');
    expect(releaseWorkflow).toContain(
      "base.replace(`_${version}`, '').replace(`-${version}`, '')",
    );
    expect(releaseWorkflow).toContain("new Set(['.deb', '.AppImage', '.dmg', '.exe', '.msi'])");
  });

  test('Microsoft Store Tauri config uses the offline WebView2 installer', () => {
    const conf = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'tauri/tauri.microsoft-store.conf.json'),
        'utf8',
      ),
    );
    expect(conf.bundle?.targets).toEqual(['nsis']);
    expect(conf.bundle?.windows?.webviewInstallMode?.type).toBe(
      'offlineInstaller',
    );
  });

  test('Snapcraft packages the Tauri binary for Ubuntu App Center', () => {
    const snapcraft = fs.readFileSync(
      path.join(repoRoot, 'snap/snapcraft.yaml'),
      'utf8',
    );
    const desktop = fs.readFileSync(
      path.join(repoRoot, 'snap/gui/markdown-explorer.desktop'),
      'utf8',
    );

    expect(snapcraft).toContain('name: markdown-explorer');
    expect(snapcraft).toContain('base: core24');
    expect(snapcraft).toContain('confinement: strict');
    expect(snapcraft).toContain('extensions: [gnome]');
    expect(snapcraft).toContain('plugin: dump');
    expect(snapcraft).toContain('command: usr/bin/markdown-explorer');
    expect(desktop).toContain('Exec=markdown-explorer %F');
    expect(desktop).toContain('MimeType=text/markdown;');
  });

});
