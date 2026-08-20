import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const globalCssPath = new URL('../../ui/src/styles/global.css', import.meta.url);
const followupCssPath = new URL('../../ui/src/styles/global/global-export-runtime-followup.css', import.meta.url);

test('loads a late export-runtime follow-up stylesheet', () => {
  const globalCss = readFileSync(globalCssPath, 'utf8');
  assert.match(globalCss, /@import '\.\/global\/global-export-runtime-followup\.css';/);
  assert.equal(existsSync(followupCssPath), true, 'export runtime follow-up stylesheet should exist');
});

test('keeps Export Center below the topbar and scrolls collapsed code with its gutter', () => {
  assert.equal(existsSync(followupCssPath), true, 'export runtime follow-up stylesheet should exist');
  if (!existsSync(followupCssPath)) return;
  const css = readFileSync(followupCssPath, 'utf8');
  assert.match(css, /\.export-center\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?justify-content:\s*flex-start;/);
  assert.match(css, /\.mdn-codeblock\[data-collapsed="true"\]\s+\.mdn-codeblock-body\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.match(css, /\.mdn-codeblock\[data-collapsed="true"\]\s+\.mdn-codeblock-gutter/);
});

test('bounds exported media viewer controls to the viewport', () => {
  assert.equal(existsSync(followupCssPath), true, 'export runtime follow-up stylesheet should exist');
  if (!existsSync(followupCssPath)) return;
  const css = readFileSync(followupCssPath, 'utf8');
  assert.match(css, /\.mdn-export-media-viewer\s*\{[\s\S]*?box-sizing:\s*border-box;/);
  assert.match(css, /\.mdn-export-media-viewer\s+\.mdn-modal-btn--prev\s*\{[\s\S]*?position:\s*absolute;/);
  assert.match(css, /\.mdn-export-media-viewer\s+\.mdn-modal-btn--next\s*\{[\s\S]*?position:\s*absolute;/);
  assert.match(css, /\.mdn-export-media-viewer\s+\.mdn-modal-media-container\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/);
});
