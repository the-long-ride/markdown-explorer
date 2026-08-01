import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');

function readWorkflow(name: string) {
  return fs.readFileSync(
    path.join(repoRoot, '.github', 'workflows', name),
    'utf8',
  );
}

describe('GitHub Actions workflow contracts', () => {
  test('test workflow uses packageManager as the pnpm version source', () => {
    const workflow = readWorkflow('test.yml');
    expect(workflow).not.toMatch(/pnpm\/action-setup@v4[\s\S]*version:\s*11/);
  });

  test('deploy website workflow uses Node 24 and packageManager pnpm version', () => {
    const workflow = readWorkflow('deploy-website.yml');
    expect(workflow).toMatch(/node-version:\s*['"]?24['"]?/);
    expect(workflow).not.toMatch(/pnpm\/action-setup@v4[\s\S]*version:\s*11/);
  });

  test('test workflow runs UI tests on pull requests', () => {
    const workflow = readWorkflow('test.yml');
    expect(workflow).toContain('pnpm run test:ui');
  });

  test('tauri CI jobs avoid restoring cached target artifacts', () => {
    const workflow = readWorkflow('test.yml');
    expect(workflow).not.toContain('Swatinem/rust-cache@v2');
  });

  test('tauri tests run on Linux, Windows, and macOS', () => {
    const workflow = readWorkflow('test.yml');
    const tauriJob = workflow.slice(
      workflow.indexOf('\n  tauri:'),
      workflow.indexOf('\n  tauri-coverage:'),
    );

    expect(tauriJob).toMatch(/os:\s*\[ubuntu-latest, windows-latest, macos-latest\]/);
    expect(tauriJob).toContain("if: runner.os == 'Linux'");
    expect(tauriJob).toContain('pnpm run build:ui:electron');
    expect(tauriJob).toContain('pnpm run test:tauri');
  });

  test('tauri CI jobs build frontend dist before cargo compiles', () => {
    const workflow = readWorkflow('test.yml');
    const uiBuilds = workflow.match(/pnpm run build:ui:electron/g) ?? [];
    expect(uiBuilds).toHaveLength(2);
    expect(workflow).toMatch(
      /pnpm run build:ui:electron[\s\S]*pnpm run test:tauri/,
    );
    expect(workflow).toMatch(
      /pnpm run build:ui:electron[\s\S]*cargo llvm-cov/,
    );
  });

  test('tauri coverage serializes Rust tests like test:tauri', () => {
    const workflow = readWorkflow('test.yml');
    const serializedCoverageRuns =
      workflow.match(/cargo llvm-cov[\s\S]*?-- --test-threads=1/g) ?? [];
    expect(serializedCoverageRuns).toHaveLength(2);
  });

  test('release workflow keeps Electron and Tauri desktop builds separate', () => {
    const workflow = readWorkflow('release.yml');
    expect(workflow).toContain('name: Build Electron Desktop Application');
    expect(workflow).toContain('pnpm run build:electron');
    expect(workflow).toContain('name: Build Tauri Desktop Application');
    expect(workflow).toContain('os: [windows-latest, ubuntu-latest, macos-latest]');
    expect(workflow).toContain('cargo tauri build --bundles nsis');
    expect(workflow).toContain('cargo tauri build --bundles appimage,deb');
    expect(workflow).toContain('cargo tauri build --bundles dmg');
  });

  test('release workflow generates grouped download notes', () => {
    const workflow = readWorkflow('release.yml');
    expect(workflow).toContain('node .github/scripts/release-notes.mjs');
    expect(workflow).toContain('RELEASE_ASSETS_DIR: ./release-assets');
    expect(workflow).toContain('body_path: ./release-notes.md');
    expect(workflow).not.toContain('Markdown Explorer release package guide.');
    expect(workflow).toMatch(
      /publish-release:[\s\S]*uses: actions\/checkout@v6/,
    );
    expect(workflow).toContain("safe_base=${base// /.}");
    expect(workflow).toContain('overwrite_files: true');
  });

  test('desktop store workflow publishes Tauri packages from reusable releases', () => {
    const workflow = readWorkflow('publish-desktop-stores.yml');
    expect(workflow).toContain('workflow_call:');
    expect(workflow).toContain('tauri.microsoft-store.conf.json');
    expect(workflow).toContain('microsoft/microsoft-store-apppublisher@v1.1');
    expect(workflow).toContain('msstore submission update');
    expect(workflow).toContain('msstore submission publish');
    expect(workflow).toContain('SNAPCRAFT_STORE_CREDENTIALS');
    expect(workflow).toContain('snapcraft upload');
    expect(workflow).toContain('dry_run');
  });

  test('desktop store workflow keeps all publishing credentials in secrets', () => {
    const workflow = readWorkflow('publish-desktop-stores.yml');
    expect(workflow).toContain('secrets.AZURE_AD_APPLICATION_CLIENT_ID');
    expect(workflow).toContain('secrets.AZURE_AD_APPLICATION_SECRET');
    expect(workflow).toContain('secrets.AZURE_AD_TENANT_ID');
    expect(workflow).toContain('secrets.MICROSOFT_STORE_SELLER_ID');
    expect(workflow).toContain('secrets.MICROSOFT_STORE_PRODUCT_ID');
    expect(workflow).toContain('secrets.WINDOWS_CERTIFICATE_BASE64');
    expect(workflow).toContain('secrets.WINDOWS_CERTIFICATE_PASSWORD');
    expect(workflow).toContain('secrets.SNAPCRAFT_STORE_CREDENTIALS');
    expect(workflow).not.toMatch(/clientSecret:\s*["']?[A-Za-z0-9_-]{12,}/);
  });

  test('release publishes GitHub Release before reusable desktop-store publishing', () => {
    const release = readWorkflow('release.yml');
    const stores = readWorkflow('publish-desktop-stores.yml');
    const desktopStoresJob = release.match(
      /  desktop-stores:\r?\n([\s\S]*?)(?=\r?\n  [\w-]+:\r?\n|\r?\n*$)/,
    )?.[1];

    expect(release).toContain('publish-release:');
    expect(release).toContain('uses: ./.github/workflows/publish-desktop-stores.yml');
    expect(desktopStoresJob).toBeDefined();
    expect(desktopStoresJob).toMatch(/needs:\s*publish-release/);
    expect(desktopStoresJob).toMatch(/tag:\s*\$\{\{[^}]+\}\}/);
    expect(desktopStoresJob).toMatch(/dry_run:\s*\$\{\{[^}]+\}\}/);
    expect(release).toMatch(/publish-release:[\s\S]*draft:\s*false/);
    expect(release).not.toContain('create-draft-release:');

    expect(stores).toContain('workflow_call:');
    expect(stores).toContain('vars.PUBLISH_MICROSOFT_STORE');
    expect(stores).toContain('vars.PUBLISH_UBUNTU_APP_CENTER');
    expect(stores).toContain('vars.SNAP_CHANNEL');
    expect(stores).not.toMatch(/inputs\.publish_/);
    expect(stores).not.toMatch(/inputs\.snap_channel/);
    expect(stores).not.toContain('STORE_ENVIRONMENT');
  });

});
