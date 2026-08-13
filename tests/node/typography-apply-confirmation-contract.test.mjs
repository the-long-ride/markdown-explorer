import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const typography = read('ui/src/components/Settings/DesktopTypographySettings.tsx');
const icons = read('ui/src/components/shared/icons.tsx');
const tooltip = read('ui/src/components/shared/TooltipButton.tsx');
const topbar = read('ui/src/components/Topbar/Topbar.tsx');
const docsPreferences = read('docs/instructions/02-use-cases/UC-017-preferences.md');
const docsSettings = read('docs/instructions/03-features/12-settings-preferences-import-export.md');

const helpersUrl = new URL('ui/src/components/Settings/desktopTypographyChanges.ts', root);

test('Typography apply uses explicit dirty-state helper and requested apply icon', () => {
  assert.equal(existsSync(helpersUrl), true, 'desktopTypographyChanges.ts should exist');
  assert.match(typography, /desktopTypographyBindingsEqual/);
  assert.match(typography, /disabled=\{!changed\}/);
  assert.match(typography, /TypographyApplyIcon/);
  assert.match(icons, /export const TypographyApplyIcon/);
  assert.match(icons, /viewBox="0 0 122\.881 122\.88"/);
});

test('Typography apply opens a per-role confirmation dialog before persisting', () => {
  assert.match(typography, /fontApplyConfirmOpen/);
  assert.match(typography, /getDesktopTypographyChanges/);
  assert.match(typography, /desktop-typography-confirm-dialog/);
  assert.match(typography, /fontApplyConfirmTitle/);
  assert.match(typography, /fontApplyChanges/);
  assert.match(typography, /updateSettings\(\{ fontBindings: draft \}\)/);
  assert.doesNotMatch(typography, /onClick=\{\(\) => updateSettings\(\{ fontBindings: draft \}\)\}/);
});

test('VS Code Edit opts into a portal tooltip that preserves shortcut keycaps', () => {
  assert.match(tooltip, /portalTooltip\?: boolean/);
  assert.match(tooltip, /createPortal/);
  assert.match(tooltip, /getBoundingClientRect/);
  assert.match(tooltip, /tooltip-portal/);
  assert.match(topbar, /topbar__edit-action[\s\S]*portalTooltip/);
  assert.match(topbar, /shortcut=\{getEnabledShortcut\(state\.settings, 'editCurrentDocument'\)\}/);
});

test('preference docs describe dirty Apply and confirmation summary', () => {
  assert.match(docsPreferences, /Apply/i);
  assert.match(docsPreferences, /changed roles/i);
  assert.match(docsSettings, /confirmation/i);
  assert.match(docsSettings, /Typography/i);
});
