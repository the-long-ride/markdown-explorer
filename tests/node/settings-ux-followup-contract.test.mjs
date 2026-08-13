import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const typography = read('ui/src/components/Settings/DesktopTypographySettings.tsx');
const settingsModal = read('ui/src/components/Settings/SettingsModal.tsx');
const updatePanel = read('ui/src/components/Settings/SettingsUpdateBackupPanel.tsx');
const icons = read('ui/src/components/shared/icons.tsx');
const navCss = read('ui/src/styles/global/global-settings-navigation.css');
const layoutCss = read('ui/src/styles/global/global-settings-layout.css');
const typographyCss = read('ui/src/styles/global/global-settings-typography.css');
const constants = read('ui/src/contexts/appStateConstants.ts');
const actions = read('ui/src/components/Settings/settingsActions.ts');
const keyboardUtils = read('ui/src/hooks/keyboardUtils.ts');
const useKeyboard = read('ui/src/hooks/useKeyboard.ts');
const toolbarMenu = read('ui/src/components/shared/ToolbarActionMenu.tsx');
const topbar = read('ui/src/components/Topbar/Topbar.tsx');
const desktopTabBar = read('ui/src/components/Desktop/DesktopTabBar.tsx');
const translations = read('ui/src/contexts/translationsData.ts');
const readme = read('README.md');
const shortcutDocs = read('docs/instructions/05-reference/04-shortcut-catalog.md');
const settingsDocs = read('docs/instructions/05-reference/03-settings-catalog.md');

test('shared Settings outline button is reused by typography and update/backup actions', () => {
  assert.equal(existsSync(new URL('../../ui/src/components/Settings/SettingsOutlineButton.tsx', import.meta.url)), true);
  const shared = read('ui/src/components/Settings/SettingsOutlineButton.tsx');
  assert.match(shared, /TooltipButton/);
  assert.match(shared, /settings-outline-button/);
  assert.match(typography, /SettingsOutlineButton/);
  assert.match(updatePanel, /SettingsOutlineButton/);
  assert.match(typography, /ImportSettingsIcon/);
  assert.match(typography, /tooltip=\{t\.fontImport\}/);
});

test('Typography keeps its header fixed and scrolls only the font role region', () => {
  assert.match(typography, /desktop-typography-settings__scroll/);
  assert.match(settingsModal, /settings-navigation__content--typography/);
  assert.match(navCss, /settings-navigation__content--typography[\s\S]*overflow:\s*hidden/);
  assert.match(typographyCss, /desktop-typography-settings__scroll[\s\S]*overflow-y:\s*auto/);
  const typographyBlock = typographyCss.match(/\.desktop-typography-settings\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(typographyBlock, /display:\s*flex/);
  assert.doesNotMatch(typographyBlock, /display:\s*grid/);
});

test('Settings close tooltip uses keycap shortcut and navigation uses supplied icons', () => {
  assert.match(settingsModal, /shortcut="Esc"/);
  assert.doesNotMatch(translations, /closeSettings:\s*[^\n]*\(Esc\)/);
  for (const name of ['SettingsAppearanceIcon', 'SettingsTypographyIcon', 'SettingsThemeStyleIcon', 'SettingsShortcutsIcon', 'SettingsUpdateBackupIcon']) {
    assert.match(icons, new RegExp(`export const ${name}`));
    assert.match(settingsModal, new RegExp(name));
  }
  assert.match(icons, /viewBox="0 0 512 401\.6"/);
  assert.match(updatePanel, /SettingsUpdateBackupIcon/);
});

test('Edit shortcut defaults and visibility are host-specific', () => {
  assert.match(constants, /VSCODE_DEFAULT_KEYBINDINGS/);
  assert.match(constants, /editCurrentDocument:\s*'Ctrl\+Alt\+E'/);
  assert.match(constants, /DESKTOP_DEFAULT_KEYBINDINGS[\s\S]*editCurrentDocument:\s*'Ctrl\+E'/);
  assert.match(constants, /getDefaultKeybindingsForRuntime/);
  assert.match(actions, /id:\s*'editCurrentDocument'/);
  assert.match(actions, /scope:\s*'editor'/);
  assert.match(settingsModal, /act\.scope === "editor"/);
});

test('Edit shortcut dispatch uses existing openInEditor and toolbar placement differs by host', () => {
  assert.match(keyboardUtils, /edit-current-document/);
  assert.match(useKeyboard, /openInEditor/);
  assert.match(useKeyboard, /case 'edit-current-document'/);
  assert.match(toolbarMenu, /editShortcut\?: string/);
  assert.match(toolbarMenu, /buildShortcutTooltip\(editTooltip, editShortcut\)/);
  assert.match(topbar, /topbar__edit-action/);
  assert.match(topbar, /state\.appRuntime === 'vscode'/);
  assert.match(topbar, /editCurrentDocument/);
  assert.match(topbar, /showEdit=\{state\.appRuntime === 'desktop' \|\| state\.appRuntime === 'tauri'\}/);
  assert.match(desktopTabBar, /editShortcut=\{getEnabledShortcut\(state\.settings, 'editCurrentDocument'\)\}/);
});

test('README and reference docs describe the new Edit shortcuts and Settings behavior', () => {
  assert.match(readme, /Ctrl\+E/);
  assert.match(readme, /Ctrl\+Alt\+E/);
  assert.match(shortcutDocs, /Edit current document/i);
  assert.match(shortcutDocs, /Ctrl\+E/);
  assert.match(shortcutDocs, /Ctrl\+Alt\+E/);
  assert.match(settingsDocs, /Typography/i);
  assert.match(settingsDocs, /scroll/i);
});
