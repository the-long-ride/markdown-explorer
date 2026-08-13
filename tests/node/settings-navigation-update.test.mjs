import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  getSkippedUpdateVersion,
  shouldNotifyForUpdate,
  skipUpdateVersion,
} from '../../ui/src/updateNotification.ts';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

const updateBackupKeys = [
  'updateBackup', 'updateBackupDesc', 'applicationUpdate', 'checkForUpdate',
  'settingsBackup', 'settingsBackupDesc', 'latestVersionStatus', 'newerVersionStatus',
  'updateLater', 'updateSkipVersion', 'updateChecking',
];

test('settings modal uses translated sidebar navigation with requested sections', async () => {
  const source = await read('ui/src/components/Settings/SettingsModal.tsx');
  assert.match(source, /label:\s*t\.appearance/);
  assert.match(source, /label:\s*t\.typography/);
  assert.match(source, /label:\s*t\.themeStyle/);
  assert.match(source, /label:\s*t\.shortcuts/);
  assert.match(source, /label:\s*t\.updateBackup/);
  assert.match(source, /settings-navigation__item/);
});

test('Update & Backup copy is typed and translated in all nine locales', async () => {
  const [types, data] = await Promise.all([
    read('ui/src/contexts/translationTypes.ts'),
    read('ui/src/contexts/translationsData.ts'),
  ]);
  for (const key of updateBackupKeys) {
    assert.match(types, new RegExp(`\\b${key}:\\s*string;`));
    assert.equal(data.match(new RegExp(`\\b${key}:`, 'g'))?.length ?? 0, 9, key);
  }
});

test('update panel uses exact current/latest version status templates', async () => {
  const source = await read('ui/src/components/Settings/SettingsUpdateBackupPanel.tsx');
  assert.match(source, /t\.latestVersionStatus\.replace\(['"]\{current\}['"]/);
  assert.match(source, /t\.newerVersionStatus\.replace\(['"]\{current\}['"]/);
  assert.match(source, /replace\(['"]\{latest\}['"]/);
  const data = await read('ui/src/contexts/translationsData.ts');
  assert.match(data, /latestVersionStatus:\s*"You are using version \{current\} - latest version\."/);
  assert.match(data, /newerVersionStatus:\s*"You are using version \{current\} - current latest version is \{latest\}"/);
});

test('per-version update skip only suppresses the matching version', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
  assert.equal(shouldNotifyForUpdate(true, 'v2.0.0', ''), true);
  skipUpdateVersion('v2.0.0', storage);
  const skipped = getSkippedUpdateVersion(storage);
  assert.equal(skipped, '2.0.0');
  assert.equal(shouldNotifyForUpdate(true, '2.0.0', skipped), false);
  assert.equal(shouldNotifyForUpdate(true, '2.1.0', skipped), true);
});

test('available update startup dialog uses translated later, skip-version, download and changelog actions', async () => {
  const [hook, dialog, appView] = await Promise.all([
    read('ui/src/hooks/useUpdateNotificationState.ts'),
    read('ui/src/components/Settings/AvailableUpdateDialog.tsx'),
    read('ui/src/AppView.tsx'),
  ]);
  assert.match(hook, /promptOpen/);
  assert.match(hook, /skipVersion/);
  assert.match(dialog, /t\.updateSkipVersion/);
  assert.match(dialog, /t\.update\.viewChangelog/);
  assert.match(dialog, /t\.update\.downloadButton/);
  assert.match(dialog, /t\.updateLater/);
  assert.match(appView, /t=\{t\}/);
});

test('update attention is propagated to toolbar/settings badges', async () => {
  const [appView, toolbar, css] = await Promise.all([
    read('ui/src/AppView.tsx'),
    read('ui/src/components/shared/ToolbarActionMenu.tsx'),
    read('ui/src/styles/global/global-settings-navigation.css'),
  ]);
  assert.match(appView, /hasUpdateAttention/);
  assert.match(toolbar, /hasUpdate/);
  assert.match(css, /settings-nav-badge-dot/);
});

test('update panel contains no stale derived version local rejected by noUnusedLocals', async () => {
  const source = await read('ui/src/components/Settings/SettingsUpdateBackupPanel.tsx');
  assert.doesNotMatch(source, /const version = hostUpdateState\.downloadedVersion \|\| updateCheck\.latestVersion;/);
});
