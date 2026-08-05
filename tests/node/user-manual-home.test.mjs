import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('user manual is the second welcome tab with searchable task sections', async () => {
  const [welcome, manual, labels] = await Promise.all([
    read('ui/src/components/Content/WelcomePage.tsx'),
    read('ui/src/components/Content/UserManualTab.tsx'),
    read('ui/src/components/Content/welcomeLabels.ts'),
  ]);
  assert.match(welcome, /activeTab === 'manual'/);
  const featureIndex = welcome.indexOf("setActiveTab('features')");
  const manualIndex = welcome.indexOf("setActiveTab('manual')");
  const shortcutsIndex = welcome.indexOf("setActiveTab('shortcuts')");
  assert.ok(featureIndex >= 0 && manualIndex > featureIndex && shortcutsIndex > manualIndex);
  assert.match(manual, /manual-search/);
  assert.match(manual, /manual\.sections/);
  assert.match(manual, /open-workspace-selection/);
  assert.match(manual, /open-sidebar-search/);
  assert.match(manual, /open-bookmarks/);
  assert.match(manual, /open-settings/);
  assert.match(labels, /manual:/);
});

test('manual covers exact object bookmarks, multiline selections, and changed targets', async () => {
  const translations = await read('ui/src/contexts/userManualTranslations.ts');
  assert.match(translations, /multiple lines/i);
  assert.match(translations, /LaTeX/);
  assert.match(translations, /Mermaid/);
  assert.match(translations, /exact saved occurrence/i);
  assert.match(translations, /Target changed/i);
});

test('user manual copy exists for every supported language', async () => {
  const translations = await read('ui/src/contexts/userManualTranslations.ts');
  for (const language of ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru']) {
    assert.match(translations, new RegExp(`\\b${language}:\\s*\\{`));
  }
});

test('manual action events are isolated in a reusable app-shell hook', async () => {
  const [app, hook] = await Promise.all([
    read('ui/src/App.tsx'),
    read('ui/src/hooks/useUserManualActions.ts'),
  ]);
  assert.match(app, /useUserManualActions/);
  for (const eventName of ['open-workspace-selection', 'open-sidebar-search', 'open-bookmarks', 'open-settings']) {
    assert.match(hook, new RegExp(eventName));
  }
});
