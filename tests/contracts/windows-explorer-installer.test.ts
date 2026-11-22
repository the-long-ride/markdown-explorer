import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const hooks = readFileSync(resolve(root, 'tauri/windows/explorer-hooks.nsh'), 'utf8');
const config = JSON.parse(readFileSync(resolve(root, 'tauri/tauri.conf.json'), 'utf8'));
const electronConfig = JSON.parse(readFileSync(resolve(root, 'electron/package.json'), 'utf8'));
const electronHooksPath = resolve(root, 'electron/build/installer.nsh');

describe('Windows Explorer installer integration', () => {
  test('uses Electron NSIS hooks with the same opt-in File Explorer choices', () => {
    expect(electronConfig.build.nsis.include).toBe('build/installer.nsh');
    expect(existsSync(electronHooksPath)).toBe(true);

    const electronHooks = readFileSync(electronHooksPath, 'utf8');
    expect(electronConfig.build.nsis.createDesktopShortcut).toBe(false);
    expect(electronConfig.build.nsis.createStartMenuShortcut).toBe(false);
    expect(electronHooks).toContain('!macro customPageAfterChangeDir');
    expect(electronHooks).toContain('!ifndef BUILD_UNINSTALLER');
    expect(electronHooks).toContain('!include "MUI2.nsh"');
    expect(electronHooks).toContain('Create desktop shortcut');
    expect(electronHooks).toContain('Add Markdown Explorer to Start menu');
    expect(electronHooks).toContain('${NSD_Check} $ME_StartMenuShortcutCheckbox');
    expect(electronHooks).not.toContain('${NSD_Check} $ME_DesktopShortcutCheckbox');
    expect(electronHooks).toContain('Add Markdown Explorer to .md and .mdx context menus');
    expect(electronHooks).toContain('Add Open Folder in Markdown Explorer to File Explorer');
    expect(electronHooks).toContain('SystemFileAssociations\\.md\\shell\\MarkdownExplorer');
    expect(electronHooks).toContain('Directory\\Background\\shell\\MarkdownExplorer');

    // Declaring top-level NSIS Function blocks outside macros causes
    // electron-builder to compile them before !addplugindir is emitted.
    let inMacro = false;
    for (const rawLine of electronHooks.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (/^!macro\b/i.test(line)) {
        inMacro = true;
      } else if (/^!macroend\b/i.test(line)) {
        inMacro = false;
      } else if (/^Function\b/i.test(line)) {
        expect(inMacro).toBe(true);
      }
    }
    expect(inMacro).toBe(false);
  });

  test('uses Tauri NSIS hooks and defines a checked-by-default options page', () => {
    expect(config.bundle.windows.nsis.installerHooks).toBe('./windows/explorer-hooks.nsh');
    // Tauri includes installerHooks before declaring its pages. A direct Page
    // declaration is compiled; a custom macro is ignored unless a template
    // explicitly invokes it.
    expect(hooks).not.toContain('!macro NSIS_CUSTOM_PAGES');
    expect(hooks).toContain('Page custom MarkdownExplorerOptions MarkdownExplorerOptionsLeave');
    expect(hooks).not.toContain('${NSD_Check} $ME_DesktopShortcutCheckbox');
    expect(hooks).toContain('Add Markdown Explorer to Start menu');
    expect(hooks).toContain('${NSD_Check} $ME_StartMenuShortcutCheckbox');
    expect(hooks).toContain('${NSD_Check} $ME_MarkdownContextCheckbox');
    expect(hooks).toContain('${NSD_Check} $ME_FolderContextCheckbox');
  });

  test('reads choices when leaving the page instead of showing a dialog during installation', () => {
    expect(hooks).toContain('nsDialogs::Show');
    expect(hooks).toContain('${NSD_GetState} $ME_DesktopShortcutCheckbox $ME_CreateDesktopShortcut');
    expect(hooks).toContain('${NSD_GetState} $ME_StartMenuShortcutCheckbox $ME_CreateStartMenuShortcut');
    expect(hooks).toContain('${NSD_GetState} $ME_MarkdownContextCheckbox $ME_AddMarkdownContext');
    expect(hooks).toContain('${NSD_GetState} $ME_FolderContextCheckbox $ME_AddFolderContext');
    expect(hooks).not.toContain('StrCpy $ME_CreateDesktopShortcut ${BST_CHECKED}');
    expect(hooks).toContain('Call CreateOrUpdateDesktopShortcut');
  });

  test('registers quoted Markdown, folder, and folder-background commands then removes only owned keys', () => {
    expect(hooks).toContain('SystemFileAssociations\\.md\\shell\\MarkdownExplorer');
    expect(hooks).toContain('SystemFileAssociations\\.mdx\\shell\\MarkdownExplorer');
    expect(hooks).toContain('Directory\\shell\\MarkdownExplorer');
    expect(hooks).toContain('Directory\\Background\\shell\\MarkdownExplorer');
    expect(hooks).toContain('"%1"');
    expect(hooks).toContain('"%V"');
    expect(hooks).toContain('$INSTDIR\\${MAINBINARYNAME}.exe');
    expect(hooks).toContain('"Icon"');
    expect(hooks).toContain('DeleteRegKey HKCU');
  });

  test('provides opt-in full app and temp data cleanup on uninstall for both desktop installers', () => {
    const electronHooks = readFileSync(electronHooksPath, 'utf8');

    expect(electronHooks).toContain('!macro customUnWelcomePage');
    expect(electronHooks).toContain('UninstPage custom un.MarkdownExplorerUninstallOptions un.MarkdownExplorerUninstallOptionsLeave');
    expect(electronHooks).toContain('Delete all application data, settings, cache, and temporary files on this device');
    expect(electronHooks).toContain('!macro customUnInit');
    expect(electronHooks).toContain('--delete-app-data');
    expect(electronHooks).toContain('${ifNot} ${isUpdated}');
    expect(electronHooks).toContain('$ME_UnCleanAppData == ${BST_CHECKED}');
    expect(electronHooks).toContain('$APPDATA\\${APP_PRODUCT_FILENAME}');
    expect(electronHooks).toContain('$LOCALAPPDATA\\${APP_PRODUCT_FILENAME}');
    expect(electronHooks).toContain('$LOCALAPPDATA\\markdown-explorer-updater');
    expect(electronHooks).toContain('$TEMP\\markdown-explorer-updater');
    expect(electronHooks).toContain('Function un.RemoveTempEntries');
    expect(electronHooks).toContain('Call un.RemoveTempEntries');

    expect(hooks).toContain('!macro NSIS_HOOK_POSTUNINSTALL');
    expect(hooks).toContain('${If} $DeleteAppDataCheckboxState = 1');
    expect(hooks).toContain('${AndIf} $UpdateMode <> 1');
    expect(hooks).toContain('$APPDATA\\com.the-long-ride.markdown-explorer');
    expect(hooks).toContain('$LOCALAPPDATA\\com.the-long-ride.markdown-explorer');
    expect(hooks).toContain('$LOCALAPPDATA\\com.the-long-ride.markdown-explorer-updater');
    expect(hooks).toContain('$TEMP\\markdown-explorer-updater');
    expect(hooks).toContain('$TEMP\\markdown-explorer-external-open');
    expect(hooks).toContain('Function un.RemoveTempEntries');

    const electronMain = readFileSync(resolve(root, 'electron/main.js'), 'utf8');
    expect(electronMain).toContain('markdown-explorer-v8-cache');
  });
});
