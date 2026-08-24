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

test('collapsed code uses one vertical scroll owner and never covers the final line', () => {
  const css = readFileSync(followupCssPath, 'utf8');
  assert.match(css, /\.mdn-codeblock\[data-collapsed="true"\]\s+\.mdn-codeblock-body\s*\{[\s\S]*?align-items:\s*flex-start;[\s\S]*?overflow-y:\s*auto;/);
  assert.match(css, /\.mdn-codeblock\[data-collapsed="true"\]\s+\.mdn-pre\s*\{[\s\S]*?height:\s*max-content;[\s\S]*?overflow-y:\s*hidden;/);
  assert.match(css, /\.mdn-codeblock\[data-collapsed="true"\]\s+\.mdn-codeblock-body::after\s*\{[\s\S]*?display:\s*none;/);
  assert.match(css, /\.mdn-codeblock\[data-collapsed="true"\]\s+\.mdn-codeblock-toggle-btn\s*\{[\s\S]*?linear-gradient/);
});

test('Export Center follow-up preserves label text selection without overriding shared modal geometry', () => {
  const css = readFileSync(followupCssPath, 'utf8');
  assert.doesNotMatch(css, /\.export-center\s*\{/);
  assert.match(css, /\.export-center__card\s*\{[\s\S]*?user-select:\s*text;/);
  assert.match(css, /\.export-center__card\s*\{[\s\S]*?-webkit-user-select:\s*text;/);
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

test('exported Explorer shell is viewport-contained with independent scroll owners', () => {
  const css = readFileSync(followupCssPath, 'utf8');
  assert.match(css, /html\[data-mdn-export="true"\]\s+\.mdn-export-shell\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /html\[data-mdn-export="true"\]\s+\.mdn-export-topbar\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;/);
  assert.match(css, /html\[data-mdn-export="true"\]\s+\.mdn-export-sidebar,[\s\S]*?html\[data-mdn-export="true"\]\s+\.mdn-export-main,[\s\S]*?html\[data-mdn-export="true"\]\s+\.mdn-export-file-list\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*auto;/);
});

test('exported Explorer scroll owners use the app scrollbar contract', () => {
  const css = readFileSync(followupCssPath, 'utf8');
  assert.match(css, /html\[data-mdn-export="true"\]\s+\.mdn-export-sidebar,[\s\S]*?scrollbar-width:\s*thin;[\s\S]*?scrollbar-color:\s*var\(--bd-s\) transparent;/);
  assert.match(css, /\.mdn-export-sidebar::-webkit-scrollbar,[\s\S]*?\.mdn-export-main::-webkit-scrollbar,[\s\S]*?\.mdn-export-file-list::-webkit-scrollbar\s*\{[\s\S]*?width:\s*5px;[\s\S]*?height:\s*5px;/);
  assert.match(css, /\.mdn-export-sidebar::-webkit-scrollbar-thumb,[\s\S]*?background:\s*var\(--bd-s\);[\s\S]*?border-radius:\s*var\(--r-s, var\(--r\)\);/);
  assert.match(css, /\.mdn-export-sidebar::-webkit-scrollbar-track,[\s\S]*?background:\s*transparent;/);
});

test('exported chart image and Mermaid viewers do not reserve native topbar height', () => {
  const css = readFileSync(followupCssPath, 'utf8');
  assert.match(css, /html\[data-mdn-export="true"\]\s+\.mdn-chart-viewer__stage\s*\{[\s\S]*?padding:\s*10px 16px 16px;/);
  assert.match(css, /html\[data-mdn-export="true"\]\s+\.mdn-export-media-viewer\s*\{[\s\S]*?padding:\s*16px 72px 78px;/);
  assert.match(css, /html\[data-mdn-export="true"\]\s+\.mdn-export-media-viewer\s+\.mdn-modal-close\s*\{[\s\S]*?top:\s*12px;/);
});
