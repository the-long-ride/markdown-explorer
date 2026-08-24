import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('new export and scope entry points consume the feature translation catalog', () => {
  const topbar = source('ui/src/components/Topbar/Topbar.tsx');
  const content = source('ui/src/components/Content/Content.tsx');
  const exportCenter = source('ui/src/components/Export/ExportCenterModal.tsx');
  const scopeView = source('ui/src/components/Modal/ScopeViewModal.tsx');

  assert.match(topbar, /getExportScopeTranslations\(currentLang\)/);
  assert.doesNotMatch(topbar, /exportLabel="Export Center"/);
  assert.doesNotMatch(topbar, /exportTooltip="Export documents"/);
  assert.match(content, /scopeLabel=\{scopeTarget \? scopeT\.openAsScope/);
  assert.doesNotMatch(content, /scopeLabel=\{scopeTarget \? ['"]Open as scope['"]/);
  assert.match(exportCenter, /getExportScopeTranslations\(state\.settings\.language\)/);
  assert.doesNotMatch(exportCenter, /aria-label="Export Center"/);
  assert.match(scopeView, /getExportScopeTranslations\(state\.settings\.language\)/);
  assert.doesNotMatch(scopeView, /aria-label="Scope view"/);
});
