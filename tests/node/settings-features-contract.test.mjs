import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('feature settings persist with safe defaults', async () => {
  const [types, model, effects, importExport] = await Promise.all([
    read('ui/src/themeTypes.ts'),
    read('ui/src/contexts/appStateModel.ts'),
    read('ui/src/contexts/useAppStateEffects.ts'),
    read('ui/src/settings/settingsImportExportBase.ts'),
  ]);

  assert.match(types, /historySidebarEnabled:\s*boolean/);
  assert.match(types, /markdownEditingEnabled:\s*boolean/);
  assert.match(types, /historySidebarEnabled\?:\s*boolean/);
  assert.match(types, /markdownEditingEnabled\?:\s*boolean/);
  assert.match(model, /historySidebarEnabled:\s*true/);
  assert.match(model, /markdownEditingEnabled:\s*false/);
  assert.match(model, /historySidebarEnabled:\s*saved\.historySidebarEnabled !== false/);
  assert.match(model, /markdownEditingEnabled:\s*saved\.markdownEditingEnabled === true/);
  assert.match(effects, /historySidebarEnabled:\s*state\.settings\.historySidebarEnabled/);
  assert.match(effects, /markdownEditingEnabled:\s*state\.settings\.markdownEditingEnabled/);
  assert.match(importExport, /historySidebarEnabled:\s*raw\.historySidebarEnabled !== false/);
  assert.match(importExport, /markdownEditingEnabled:\s*raw\.markdownEditingEnabled === true/);
});

test('settings modal exposes a Features section and feature rows are separated from Appearance', async () => {
  const [modal, panel, translations] = await Promise.all([
    read('ui/src/components/Settings/SettingsModal.tsx'),
    read('ui/src/components/Settings/SettingsPreferencesPanel.tsx'),
    read('ui/src/contexts/featureSettingsTranslations.ts'),
  ]);

  assert.match(modal, /id:\s*'features'/);
  assert.match(modal, /SettingsFeaturesIcon/);
  assert.match(panel, /section === 'features'/);
  assert.match(panel, /id="history-sidebar-enabled"/);
  assert.match(panel, /id="markdown-editing-enabled"/);
  const appearanceBlock = panel.match(/section === 'appearance'[\s\S]*?section === 'features'/)?.[0] ?? '';
  assert.doesNotMatch(appearanceBlock, /id="bookmarks-enabled"|id="file-tabs"|id="history-sidebar-enabled"/);
  for (const locale of ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru']) {
    assert.match(translations, new RegExp(`\\b${locale}:\\s*\\{`));
  }
});
