import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const hooks = readFileSync(resolve(root, 'tauri/windows/explorer-hooks.nsh'), 'utf8');
const config = JSON.parse(readFileSync(resolve(root, 'tauri/tauri.conf.json'), 'utf8'));

describe('Windows Explorer installer integration', () => {
  test('uses Tauri NSIS hooks and defines a checked-by-default options page', () => {
    expect(config.bundle.windows.nsis.installerHooks).toBe('./windows/explorer-hooks.nsh');
    expect(hooks).toContain('!macro NSIS_CUSTOM_PAGES');
    expect(hooks).toContain('Page custom MarkdownExplorerOptions MarkdownExplorerOptionsLeave');
    expect(hooks).toContain('${NSD_Check} $ME_DesktopShortcutCheckbox');
    expect(hooks).toContain('${NSD_Check} $ME_MarkdownContextCheckbox');
    expect(hooks).toContain('${NSD_Check} $ME_FolderContextCheckbox');
  });

  test('reads choices when leaving the page instead of showing a dialog during installation', () => {
    expect(hooks).toContain('nsDialogs::Show');
    expect(hooks).toContain('${NSD_GetState} $ME_DesktopShortcutCheckbox $ME_CreateDesktopShortcut');
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
});
