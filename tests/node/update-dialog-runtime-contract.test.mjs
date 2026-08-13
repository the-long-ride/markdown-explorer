import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const dialog = read('ui/src/components/Settings/AvailableUpdateDialog.tsx');
const updatePanel = read('ui/src/components/Settings/SettingsUpdateBackupPanel.tsx');
const appView = read('ui/src/AppView.tsx');
const settingsModal = read('ui/src/components/Settings/SettingsModal.tsx');
const icons = read('ui/src/components/shared/icons.tsx');
const docsUpdate = read('docs/instructions/02-use-cases/UC-027-application-update.md');
const docsVscode = read('docs/instructions/04-runtimes/03-vscode-extension.md');

test('available update dialog uses glow icon and header-contained changelog', () => {
  assert.match(icons, /export const UpdateGlowIcon/);
  assert.match(icons, /viewBox="0 0 122\.88 108\.69"/);
  assert.match(dialog, /UpdateGlowIcon/);
  const header = dialog.match(/<div className="update-available-card__header">([\s\S]*?)<\/div>\s*<div className="update-available-card__actions">/)?.[1] ?? '';
  assert.match(header, /update-available-card__changelog/);
  assert.doesNotMatch(dialog.replace(header, ''), /update-available-card__changelog/);
});

test('Later and Skip reuse outline buttons and Skip uses supplied icon', () => {
  assert.match(icons, /export const SkipUpdateVersionIcon/);
  assert.match(dialog, /SettingsOutlineButton/);
  assert.match(dialog, /label=\{t\.updateLater\}/);
  assert.match(dialog, /label=\{t\.updateSkipVersion\}/);
  assert.match(dialog, /SkipUpdateVersionIcon/);
});

test('VS Code only checks updates and never renders app-owned download actions', () => {
  assert.match(dialog, /canDownloadUpdate/);
  assert.match(dialog, /canDownloadUpdate\s*&&/);
  assert.match(appView, /canDownloadUpdate=\{state\.appRuntime !== 'vscode'\}/);
  assert.match(updatePanel, /state\.appRuntime !== 'vscode'/);
  assert.match(updatePanel, /canDownloadUpdate[\s\S]*t\.update\.downloadButton/);
  assert.match(settingsModal, /\{state\.appRuntime !== ['"]vscode['"] && isUpdateDownloaded && <DownloadedUpdateDialog/);
});

test('update docs state VS Code owns extension installation', () => {
  assert.match(docsUpdate, /VS Code/i);
  assert.match(docsUpdate, /download/i);
  assert.match(docsVscode, /update/i);
  assert.match(docsVscode, /VS Code/i);
});
