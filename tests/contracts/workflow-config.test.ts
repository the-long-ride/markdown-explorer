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
});
