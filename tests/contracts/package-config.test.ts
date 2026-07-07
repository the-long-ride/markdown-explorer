import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

async function readJson(relPath: string) {
  return JSON.parse(await readFile(resolve(root, relPath), 'utf8'));
}

describe('package configuration contracts', () => {
  describe('version synchronization', () => {
    let versions: Record<string, string>;

    test('all package manifests share the same version', async () => {
      const [root, desktop, vscode, ui, chromium, chromiumManifest] = await Promise.all([
        readJson('package.json'),
        readJson('electron/package.json'),
        readJson('vscode/package.json'),
        readJson('ui/package.json'),
        readJson('chromium-xtension/package.json'),
        readJson('chromium-xtension/manifest.json'),
      ]);

      versions = {
        root: root.version,
        desktop: desktop.version,
        vscode: vscode.version,
        ui: ui.version,
        chromium: chromium.version,
        chromiumManifest: chromiumManifest.version,
      };

      const v = versions.root;
      expect(versions.desktop).toBe(v);
      expect(versions.vscode).toBe(v);
      expect(versions.ui).toBe(v);
      expect(versions.chromium).toBe(v);
      expect(versions.chromiumManifest).toBe(v);
    });

    test('version follows semver format', async () => {
      const pkg = await readJson('package.json');
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('workspace membership', () => {
    const expectedPackages = ['ui', 'vscode', 'electron', 'chromium-xtension', 'tauri', 'tauri/sidecar/mdthem-sidecar'];

    async function readWorkspacePackages() {
      const yaml = await readFile(resolve(root, 'pnpm-workspace.yaml'), 'utf8');
      return yaml
        .split('\n')
        .filter((line) => line.trim().startsWith('- '))
        .map((line) => line.trim().slice(2).trim().replace(/^['"]|['"]$/g, ''));
    }

    test('pnpm-workspace.yaml lists all sub-packages', async () => {
      expect(existsSync(resolve(root, 'pnpm-workspace.yaml'))).toBe(true);
      const packages = await readWorkspacePackages();
      expect(packages).toEqual(expect.arrayContaining(expectedPackages));
      expect(packages).toHaveLength(expectedPackages.length);
    });

    test('root manifest declares pnpm as package manager', async () => {
      const pkg = await readJson('package.json');
      expect(pkg.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+/);
    });

    test('root manifest no longer declares npm workspaces', async () => {
      const pkg = await readJson('package.json');
      expect(pkg.workspaces).toBeUndefined();
    });

    test('every workspace sub-directory has a package.json', async () => {
      const packages = await readWorkspacePackages();
      for (const ws of packages) {
        expect(existsSync(resolve(root, ws, 'package.json'))).toBe(true);
      }
    });
  });

  describe('VS Code extension manifest', () => {
    test('declares exactly 4 commands', async () => {
      const pkg = await readJson('vscode/package.json');
      const commands = pkg.contributes.commands;
      expect(commands).toHaveLength(4);
      const ids = commands.map((c: any) => c.command).sort();
      expect(ids).toEqual([
        'markdownExplorer.open',
        'markdownExplorer.openFile',
        'markdownExplorer.refresh',
        'markdownExplorer.toggle',
      ].sort());
    });

    test('all commands use markdownExplorer prefix', async () => {
      const pkg = await readJson('vscode/package.json');
      for (const cmd of pkg.contributes.commands) {
        expect(cmd.command).toMatch(/^markdownExplorer\./);
      }
    });

    test('menus gate on .md or .mdx extensions', async () => {
      const pkg = await readJson('vscode/package.json');
      const menus = pkg.contributes.menus;
      const editorTitle = menus['editor/title'];
      const explorerContext = menus['explorer/context'];
      for (const item of [...editorTitle, ...explorerContext]) {
        expect(item.when).toMatch(/resourceExtname == \.m[dxx]/);
      }
    });

    test('declares 2 keybindings', async () => {
      const pkg = await readJson('vscode/package.json');
      const kb = pkg.contributes.keybindings;
      expect(kb).toHaveLength(2);
      const cmds = kb.map((k: any) => k.command);
      expect(cmds).toContain('markdownExplorer.open');
      expect(cmds).toContain('markdownExplorer.toggle');
    });

    test('declares 6 configuration properties', async () => {
      const pkg = await readJson('vscode/package.json');
      const props = Object.keys(pkg.contributes.configuration.properties);
      expect(props.sort()).toEqual([
        'markdownExplorer.autoRefresh',
        'markdownExplorer.defaultExpanded',
        'markdownExplorer.documentConversion',
        'markdownExplorer.excludePatterns',
        'markdownExplorer.theme',
        'markdownExplorer.themeStyle',
      ].sort());
    });

    test('theme enum matches UI ThemeMode', async () => {
      const pkg = await readJson('vscode/package.json');
      const themeConfig = pkg.contributes.configuration.properties['markdownExplorer.theme'];
      expect(themeConfig.enum).toEqual(['auto', 'light', 'dark']);
    });

    test('themeStyle enum matches UI ThemeStyle', async () => {
      const pkg = await readJson('vscode/package.json');
      const styleConfig = pkg.contributes.configuration.properties['markdownExplorer.themeStyle'];
      expect(styleConfig.enum).toEqual([
        'default', 'glass', 'bento',
        'pet-white-shiba', 'pet-shiba', 'pet-shiba-memes',
        'pet-k-ink', 'pet-cat', 'pet-hamster', 'pet-corgi',
      ]);
    });

    test('activation on startup finished', async () => {
      const pkg = await readJson('vscode/package.json');
      expect(pkg.activationEvents).toContain('onStartupFinished');
    });

    test('engine requires VS Code ^1.85.0+', async () => {
      const pkg = await readJson('vscode/package.json');
      expect(pkg.engines.vscode).toBe('^1.85.0');
    });

    test('main entry points to compiled output', async () => {
      const pkg = await readJson('vscode/package.json');
      expect(pkg.main).toBe('./out/extension.js');
    });

    test('publisher is the-long-ride', async () => {
      const pkg = await readJson('vscode/package.json');
      expect(pkg.publisher).toBe('the-long-ride');
    });

    test('declares webview sidebar view', async () => {
      const pkg = await readJson('vscode/package.json');
      const views = pkg.contributes.views['markdownExplorer'];
      expect(views).toHaveLength(1);
      expect(views[0].type).toBe('webview');
      expect(views[0].id).toBe('markdownExplorerSidebar');
    });
  });

  describe('Chromium extension manifest', () => {
    test('uses manifest version 3', async () => {
      const manifest = await readJson('chromium-xtension/manifest.json');
      expect(manifest.manifest_version).toBe(3);
    });

    test('permissions are minimal (storage only)', async () => {
      const manifest = await readJson('chromium-xtension/manifest.json');
      expect(manifest.permissions).toEqual(['storage']);
    });

    test('declares popup action with default_popup', async () => {
      const manifest = await readJson('chromium-xtension/manifest.json');
      expect(manifest.action.default_popup).toBe('popup.html');
    });

    test('content security policy is defined for extension_pages', async () => {
      const manifest = await readJson('chromium-xtension/manifest.json');
      const csp = manifest.content_security_policy.extension_pages;
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toMatch(/img-src[^;]+blob:/);
      expect(csp).toMatch(/media-src[^;]+blob:/);
    });

    test('icon paths reference existing files', async () => {
      const manifest = await readJson('chromium-xtension/manifest.json');
      const iconSizes = ['16', '48', '128'] as const;
      for (const size of iconSizes) {
        expect(existsSync(resolve(root, 'chromium-xtension', manifest.icons[size]))).toBe(true);
        expect(existsSync(resolve(root, 'chromium-xtension', manifest.action.default_icon[size]))).toBe(true);
      }
    });

    test('popup.html source exists', async () => {
      expect(existsSync(resolve(root, 'chromium-xtension/popup.html'))).toBe(true);
    });
  });

  describe('desktop (Electron) build configuration', () => {
    test('appId is com.thelongride.markdownexplorer', async () => {
      const pkg = await readJson('electron/package.json');
      expect(pkg.build.appId).toBe('com.thelongride.markdownexplorer');
    });

    test('productName is Markdown Explorer', async () => {
      const pkg = await readJson('electron/package.json');
      expect(pkg.build.productName).toBe('Markdown Explorer');
    });

    test('ASAR is enabled with node_modules unpacked', async () => {
      const pkg = await readJson('electron/package.json');
      expect(pkg.build.asar).toBe(true);
      expect(pkg.build.asarUnpack).toContain('node_modules/**');
    });

    test('bunds UI dist and assets', async () => {
      const pkg = await readJson('electron/package.json');
      const files = pkg.build.files;
      const hasUiDist = files.some((f: any) => typeof f === 'object' && f.from === '../ui/dist');
      const hasUiLogos = files.some((f: any) => typeof f === 'object' && f.from === '../ui/assets/logos');
      expect(hasUiDist).toBe(true);
      expect(hasUiLogos).toBe(true);
    });

    test('publisher matches VS Code publisher', async () => {
      const desktop = await readJson('electron/package.json');
      const vscode = await readJson('vscode/package.json');
      expect(desktop.publisher).toBe(vscode.publisher);
    });

    test('shared markdown-them dependency matches VS Code', async () => {
      const desktop = await readJson('electron/package.json');
      const vscode = await readJson('vscode/package.json');
      expect(desktop.dependencies['@the-long-ride/markdown-them'])
        .toBe(vscode.dependencies['@the-long-ride/markdown-them']);
    });
  });

  describe('cross-package asset references', () => {
    const builtAssetsExist = existsSync(resolve(root, 'vscode', 'ui', 'assets', 'icons'));

    test.skipIf(!builtAssetsExist)('VS Code extension icon exists', async () => {
      const pkg = await readJson('vscode/package.json');
      expect(existsSync(resolve(root, 'vscode', pkg.icon))).toBe(true);
    });

    test.skipIf(!builtAssetsExist)('VS Code command icons exist', async () => {
      const pkg = await readJson('vscode/package.json');
      for (const cmd of pkg.contributes.commands) {
        if (cmd.icon && typeof cmd.icon === 'object') {
          expect(existsSync(resolve(root, 'vscode', cmd.icon.light))).toBe(true);
          expect(existsSync(resolve(root, 'vscode', cmd.icon.dark))).toBe(true);
        }
      }
    });

    test.skipIf(!builtAssetsExist)('VS Code activity bar icon exists', async () => {
      const pkg = await readJson('vscode/package.json');
      const container = pkg.contributes.viewsContainers.activitybar[0];
      expect(existsSync(resolve(root, 'vscode', container.icon))).toBe(true);
    });
  });
});
