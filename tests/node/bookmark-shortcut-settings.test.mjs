import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('bookmark shortcut defaults differ for desktop and other variants', async () => {
  const constants = await read('ui/src/contexts/appStateConstants.ts');
  assert.match(constants, /DEFAULT_KEYBINDINGS[\s\S]*openBookmarks:\s*'Alt\+Shift\+B'/);
  assert.match(constants, /DESKTOP_DEFAULT_KEYBINDINGS[\s\S]*openBookmarks:\s*'Ctrl\+Shift\+B'/);
});

test('keyboard resolver exposes open-bookmarks action without firing in editable controls', async () => {
  const { resolveKeyboardAction } = await import(new URL('../../ui/src/hooks/keyboardUtils.ts', import.meta.url));
  const event = { key: 'B', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true };
  const base = {
    isDesktop: true, isDesktopLike: true, isVscode: false, isTermsOpen: false, isModalOpen: false,
    isSearchOpen: false, isFindOpen: false, isSettingsOpen: false, isSidebarCursorMode: false,
    activeSearchScope: 'current', keybindings: { openBookmarks: 'Ctrl+Shift+B' },
    hasOnCrossTabSearchOpen: false, hasOnFindOpen: false, hasOnSidebarCursorModeToggle: false,
    hasOnSidebarCursorModeClose: false, hasOnWelcome: false, hasOnToggleToc: false,
    hasOnLocateFile: false, hasOnToggleFocusMode: false, hasOnToggleDesktopViewMode: false,
    hasOnToggleFullscreen: false, hasOnFindClose: false, hasOnOpenBookmarks: true,
    isRepeat: false, isEditableTarget: false,
  };
  assert.deepEqual(resolveKeyboardAction(event, base), { type: 'open-bookmarks' });
  assert.equal(resolveKeyboardAction(event, { ...base, isEditableTarget: true }), null);
});

test('bookmark shortcut opens the tab or focuses the disabled feature setting', async () => {
  const [layout, settings, actions] = await Promise.all([
    read('ui/src/useAppLayoutEffects.ts'),
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
    read('ui/src/components/Settings/settingsActions.ts'),
  ]);
  assert.match(layout, /openSidebarBookmarks/);
  assert.match(layout, /SET_SIDEBAR_ACTIVE_TAB[^\n]*bookmarks/);
  assert.match(layout, /focus-bookmark-setting/);
  assert.match(settings, /focus-bookmark-setting/);
  assert.match(actions, /id:\s*'openBookmarks'/);
});


test('reset shortcuts uses an outline warning treatment', async () => {
  const styles = await read('ui/src/styles/global/global-media-viewer-settings-shell.css');
  const outlineOverride = styles.slice(styles.lastIndexOf('.settings-reset-shortcuts-btn,'));
  assert.match(outlineOverride, /background:\s*transparent/);
  assert.match(outlineOverride, /border:[^;]*var\(--warning/);
  assert.match(outlineOverride, /box-shadow:\s*none/);
});
