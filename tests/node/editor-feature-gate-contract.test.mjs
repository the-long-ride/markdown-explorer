import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Markdown Explorer editing is controlled by one persisted feature gate', async () => {
  const [helper, topbar, split, workingCopy, splitReducer, settingsReducer] = await Promise.all([
    read('ui/src/editor/editingFeature.ts'),
    read('ui/src/components/Topbar/Topbar.tsx'),
    read('ui/src/components/Content/SplitContent.tsx'),
    read('ui/src/editor/documentWorkingCopy.ts'),
    read('ui/src/split-view/splitViewReducer.ts'),
    read('ui/src/contexts/reducers/settingsUiReducer.ts'),
  ]);

  assert.match(helper, /isMarkdownEditingAvailable/);
  assert.match(helper, /markdownEditingEnabled === true/);
  assert.match(topbar, /editingEnabled = isMarkdownEditingAvailable\(state\.settings\)/);
  assert.match(topbar, /showEdit=\{editingEnabled &&/);
  assert.match(topbar, /onEdit=\{\(\) => \{ if \(state\.currentFile\) setDocumentEditMode\(state\.currentFile, 'inline-edit'\); \}\}/);
  assert.doesNotMatch(topbar, /onEdit=\{openInEditor\}/);
  assert.match(split, /editingEnabled \? EDITABLE_MODES : READ_ONLY_MODES/);
  assert.match(workingCopy, /if \(!isMarkdownEditingAvailable\(state\.settings\)\) return state/);
  assert.match(workingCopy, /if \(!isDocumentViewModeAllowed\(state\.settings, mode\)\) return state/);
  assert.match(splitReducer, /if \(!isDocumentViewModeAllowed\(state\.settings, mode\)\) return state/);
  assert.match(settingsReducer, /action\.settings\.markdownEditingEnabled === false/);
  assert.match(settingsReducer, /setSessionEditMode\(session, 'rendered'\)/);
});
