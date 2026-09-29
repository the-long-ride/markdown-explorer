import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('file history modal stays below the measured app header', async () => {
  const [modal, css, dialogCss] = await Promise.all([
    read('ui/src/components/History/FileHistoryModal.tsx'),
    read('ui/src/styles/global/global-file-history-modal.css'),
    read('ui/src/styles/global/global-dialog-surfaces.css'),
  ]);

  assert.match(modal, /mdn-modal mdn-app-modal-region file-history-modal/);
  assert.match(modal, /role="dialog" aria-modal="true"/);
  assert.match(css, /\.file-history__card\s*\{[^}]*var\(--modal-region-top/s);
  assert.match(css, /border-radius:\s*var\(--r-lg\)/);
  // The SHA copy tooltip must not give the commit list a horizontal scrollbar.
  assert.match(css, /\.file-history__commits\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(css, /\.file-history__sha \.tooltip-container \.tooltip-text[^{]*\{[^}]*right:\s*0/);
  assert.match(dialogCss, /--modal-region-top:\s*max\(/);
  assert.match(dialogCss, /--measured-header-bottom/);
});

test('file history uses custom selection, copyable commit SHA, and shared history icons', async () => {
  const [list, modal, icons, checkbox, copyMeta, historyContext] = await Promise.all([
    read('ui/src/components/History/FileHistoryCommitList.tsx'),
    read('ui/src/components/History/FileHistoryModal.tsx'),
    read('ui/src/components/History/HistoryActionIcons.tsx'),
    read('ui/src/components/History/HistorySelectionCheckbox.tsx'),
    read('ui/src/components/History/CopyableHistoryMeta.tsx'),
    read('ui/src/contexts/HistoryContext.tsx'),
  ]);

  assert.doesNotMatch(list, /<input\s+type=["']checkbox["']/);
  assert.match(list, /HistorySelectionCheckbox/);
  assert.match(list, /CopyableHistoryMeta display=\{entry\.shortOid\} copyValue=\{entry\.oid\}/);
  assert.match(modal, /HistoryCompareIcon/);
  assert.match(modal, /HistoryCloseIcon/);
  assert.match(historyContext, /FileHistoryModal/);
  assert.doesNotMatch(historyContext, /DocumentHistoryPanel/);
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
