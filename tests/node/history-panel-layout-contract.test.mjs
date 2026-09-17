import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('document history stays below the measured app header in focus and tab layouts', async () => {
  const [panel, css, dialogCss] = await Promise.all([
    read('ui/src/components/History/DocumentHistoryPanel.tsx'),
    read('ui/src/styles/global/global-history-diff.css'),
    read('ui/src/styles/global/global-dialog-surfaces.css'),
  ]);

  assert.match(panel, /history-panel-backdrop mdn-app-modal-region/);
  assert.match(css, /\.history-panel-backdrop\s*\{[^}]*top:\s*var\(--modal-region-top\);[^}]*right:\s*0;[^}]*bottom:\s*0;[^}]*left:\s*0;/s);
  assert.doesNotMatch(css.match(/\.history-panel-backdrop\s*\{[^}]*\}/s)?.[0] ?? '', /inset:\s*0/);
  assert.match(dialogCss, /--modal-region-top:\s*max\(/);
  assert.match(dialogCss, /--measured-header-bottom/);
});

test('document history uses compact icon actions, custom selection, and copyable commit metadata', async () => {
  const [panel, icons, checkbox, copyMeta] = await Promise.all([
    read('ui/src/components/History/DocumentHistoryPanel.tsx'),
    read('ui/src/components/History/HistoryActionIcons.tsx'),
    read('ui/src/components/History/HistorySelectionCheckbox.tsx'),
    read('ui/src/components/History/CopyableHistoryMeta.tsx'),
  ]);

  assert.doesNotMatch(panel, /<input\s+type=["']checkbox["']/);
  assert.match(panel, /HistorySelectionCheckbox/);
  assert.match(panel, /CopyableHistoryMeta display=\{revision\.shortOid\} copyValue=\{revision\.oid\}/);
  assert.match(panel, /CopyableHistoryMeta display=\{revision\.author\} copyValue=\{revision\.author\}/);
  assert.match(panel, /tooltip=\{t\.viewRevision\}[^>]*icon=\{<HistoryViewIcon/);
  assert.match(panel, /tooltip=\{t\.compareCurrent\}[^>]*icon=\{<HistoryCompareIcon/);
  assert.match(panel, /tooltip=\{t\.workingCopy\}[^>]*icon=\{<HistoryWorkingCopyIcon/);
  assert.match(checkbox, /role="checkbox"/);
  assert.match(checkbox, /aria-checked=\{checked\}/);
  assert.match(copyMeta, /bridge\.copyToClipboard\(copyValue\)/);
  assert.match(copyMeta, /aria-live="polite"/);
  assert.match(icons, /svgrepo\.com\/svg\/421552\/eye-viewed/);
  assert.match(icons, /svgrepo\.com\/svg\/509960\/git-compare/);
  assert.match(icons, /svgrepo\.com\/svg\/446984\/clipboard-copy/);
  assert.match(checkbox, /svgrepo\.com\/svg\/309414\/checkbox-checked/);
  assert.match(icons, /CC0/);
  assert.match(checkbox, /CC0/);
});
