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
  test('root package delegates VSIX packaging to the VS Code package once', async () => {
    const pkg = await readJson('package.json');
    expect(pkg.scripts.package).toBe('pnpm --filter ./vscode run package');
  });

  describe('version synchronization', () => {
    let versions: Record<string, string>;

    test('all package manifests share the same version', async () => {
      const [root, desktop, vscode, ui, websiteApp] = await Promise.all([
        readJson('package.json'),
        readJson('electron/package.json'),
        readJson('vscode/package.json'),
        readJson('ui/package.json'),
        readJson('website-app/package.json'),
      ]);

      versions = {
        root: root.version,
        desktop: desktop.version,
        vscode: vscode.version,
        ui: ui.version,
        websiteApp: websiteApp.version,
      };

      const v = versions.root;
      expect(versions.desktop).toBe(v);
      expect(versions.vscode).toBe(v);
      expect(versions.ui).toBe(v);
      expect(versions.websiteApp).toBe(v);
    });

    test('version follows semver format', async () => {
      const pkg = await readJson('package.json');
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('workspace membership', () => {
    const expectedPackages = ['ui', 'vscode', 'electron', 'tauri', 'website-app'];

    async function readWorkspacePackages() {
      const yaml = await readFile(resolve(root, 'pnpm-workspace.yaml'), 'utf8');
      const packageLines = yaml.match(/^packages:\s*\n((?:\s+-\s+.*(?:\n|$))*)/m)?.[1] ?? '';
      return packageLines
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
    test('declares expected commands', async () => {
      const pkg = await readJson('vscode/package.json');
      const commands = pkg.contributes.commands;
      expect(commands).toHaveLength(7);
      const ids = commands.map((c: any) => c.command).sort();
      expect(ids).toEqual([
        'markdownExplorer.open',
        'markdownExplorer.openFile',
        'markdownExplorer.openFolder',
        'markdownExplorer.refresh',
        'markdownExplorer.reloadWebview',
        'markdownExplorer.saveCurrentDocument',
        'markdownExplorer.toggle',
      ].sort());
    });

    test('all commands use markdownExplorer prefix', async () => {
      const pkg = await readJson('vscode/package.json');
      for (const cmd of pkg.contributes.commands) {
        expect(cmd.command).toMatch(/^markdownExplorer\./);
      }
    });

    test('menus gate on .md/.mdx extensions or folder context', async () => {
      const pkg = await readJson('vscode/package.json');
      const menus = pkg.contributes.menus;
      const editorTitle = menus['editor/title'];
      const explorerContext = menus['explorer/context'];
      expect(editorTitle[0].when).toMatch(/resourceExtname == \.m[dx]/);
      expect(explorerContext.find((c: any) => c.command === 'markdownExplorer.openFile')?.when).toMatch(/resourceExtname == \.m[dx]/);
      expect(explorerContext.find((c: any) => c.command === 'markdownExplorer.openFolder')?.when).toBe('explorerResourceIsFolder');
    });

    test('declares 4 keybindings', async () => {
      const pkg = await readJson('vscode/package.json');
      const kb = pkg.contributes.keybindings;
      expect(kb).toHaveLength(4);
      const cmds = kb.map((k: any) => k.command);
      expect(cmds).toContain('markdownExplorer.open');
      expect(cmds).toContain('markdownExplorer.toggle');
      expect(cmds).toContain('markdownExplorer.saveCurrentDocument');
      expect(cmds).toContain('markdownExplorer.reloadWebview');
    });

    test('saveCurrentDocument keybinding is scoped to webviewFocus to avoid conflicting with the editor save command', async () => {
      const pkg = await readJson('vscode/package.json');
      const kb = pkg.contributes.keybindings.find((k: any) => k.command === 'markdownExplorer.saveCurrentDocument');
      expect(kb.key).toBe('ctrl+s');
      expect(kb.mac).toBe('cmd+s');
      expect(kb.when).toBe('webviewFocus');
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
      expect(styleConfig.default).toBe('raw-grid');
      expect(styleConfig.enum).toEqual([
        'raw-grid', 'default', 'bento', 'vercel', 'tokyo-night', 'neon-voltage', 'cyberpunk',
        'pet-white-shiba',
        'pet-k-ink',
      ]);
    });

    test('activation on startup finished', async () => {
      const pkg = await readJson('vscode/package.json');
      expect(pkg.activationEvents).toContain('onStartupFinished');
    });

    test('activates when any contributed command is invoked', async () => {
      const pkg = await readJson('vscode/package.json');
      expect(pkg.activationEvents).toEqual(expect.arrayContaining([
        'onCommand:markdownExplorer.open',
        'onCommand:markdownExplorer.openFile',
        'onCommand:markdownExplorer.openFolder',
        'onCommand:markdownExplorer.toggle',
        'onCommand:markdownExplorer.refresh',
      ]));
    });

    test('engine requires VS Code ^1.85.0+', async () => {
      const pkg = await readJson('vscode/package.json');
      expect(pkg.engines.vscode).toBe('^1.85.0');
    });

    test('main entry points to compiled output', async () => {
      const pkg = await readJson('vscode/package.json');
      expect(pkg.main).toBe('./out/vscode/src/core/extension.bundle.js');
    });

    test('publisher is the-long-ride', async () => {
      const pkg = await readJson('vscode/package.json');
      expect(pkg.publisher).toBe('the-long-ride');
    });

    test('does not declare sidebar view or view container', async () => {
      const pkg = await readJson('vscode/package.json');
      expect(pkg.contributes.views).toBeUndefined();
      expect(pkg.contributes.viewsContainers).toBeUndefined();
    });
  });

  describe('desktop (Electron) build configuration', () => {
    test('Electron workspace uses the root Electron runtime and builder versions', async () => {
      const [root, desktop] = await Promise.all([
        readJson('package.json'),
        readJson('electron/package.json'),
      ]);

      expect(desktop.devDependencies.electron).toBe(root.devDependencies.electron);
      expect(desktop.devDependencies['electron-builder']).toBe(root.devDependencies['electron-builder']);
      expect(desktop.build.electronVersion).toBe(root.devDependencies.electron);
    });

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

    test('registers Markdown and MDX files with macOS Finder and Linux desktops', async () => {
      const pkg = await readJson('electron/package.json');
      const associations = pkg.build.fileAssociations;

      expect(associations).toEqual(expect.arrayContaining([
        expect.objectContaining({ ext: 'md', mimeType: 'text/markdown', role: 'Editor', rank: 'Alternate' }),
        expect.objectContaining({ ext: 'mdx', mimeType: 'application/x-markdown-explorer-mdx', role: 'Editor', rank: 'Alternate' }),
      ]));
      expect(pkg.desktopName).toBe('markdown-explorer');
      expect(pkg.build.linux.syncDesktopName).toBe(true);
      expect(pkg.build.linux.mimeTypes).toContain('inode/directory');
      expect(pkg.build.mac.icon).toBe('../ui/assets/logos/logo-512.png');
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
  });
});
