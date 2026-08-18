import test from 'node:test';
import assert from 'node:assert/strict';
import { readProjectSource } from './read-refactored-source.mjs';

const read = readProjectSource;

test('MediaModal supports a light/dark theme toggle that re-renders mermaid without clearing zoom/pan', async () => {
  const [modal, appStateCtx, gallery, snapshot, themeMode, renderToSvg] = await Promise.all([
    read('ui/src/components/Modal/MediaModal.tsx'),
    read('ui/src/contexts/AppStateContext.tsx'),
    read('ui/src/components/Modal/mediaGallery.ts'),
    read('ui/src/components/Content/enhancements/mermaidSvgSnapshot.ts'),
    read('ui/src/utils/themeMode.ts'),
    read('ui/src/components/Content/enhancements/mermaidRenderToSvg.ts'),
  ]);

  // ── MediaModal imports the new symbols ─────────────────────────────────
  assert.match(modal, /SunIcon/);
  assert.match(modal, /MoonIcon/);
  assert.match(modal, /renderMermaidToSvg/);
  assert.match(modal, /resolveThemeMode/);

  // ── setTheme is available on the App State context and the modal uses it ─
  assert.match(appStateCtx, /setTheme/);
  assert.match(modal, /setTheme/);

  // ── Theme toggle tooltip text "Toggle light/dark mode" is referenced
  //    (either via t.topbar.theme — the existing key — or t.tooltips.theme)
  assert.match(modal, /(?:topbar|tooltips)\.theme/);

  // ── The mermaid re-render useEffect must NOT touch setZoom / setPan. Find
  //    every useEffect block in MediaModal source, isolate the one whose body
  //    references renderMermaidToSvg, and assert it does not call setZoom(/setPan(
  const effectRegex = /useEffect\(\(\)\s*=>\s*\{[^]*?\},\s*\[[^\]]*\]\s*\)/g;
  const effectMatches = [...modal.matchAll(effectRegex)].map((m) => m[0]);
  assert.ok(effectMatches.length > 0, 'expected at least one useEffect in MediaModal source');
  const themeEffects = effectMatches.filter((src) => /renderMermaidToSvg\(/.test(src));
  assert.ok(
    themeEffects.length >= 1,
    'expected at least one useEffect that calls renderMermaidToSvg',
  );
  for (const effectSrc of themeEffects) {
    assert.doesNotMatch(
      effectSrc,
      /setZoom\(/,
      'theme re-render effect must NOT call setZoom (preserves zoom state)',
    );
    assert.doesNotMatch(
      effectSrc,
      /setPan\(/,
      'theme re-render effect must NOT call setPan (preserves pan state)',
    );
  }

  // ── renderMermaidToSvg is invoked with the current gallery item's source ─
  assert.match(modal, /\.source/);
  assert.match(modal, /renderMermaidToSvg\(/);

  // ── Helper exports ──────────────────────────────────────────────────────
  assert.match(themeMode, /export function resolveThemeMode/);
  assert.match(snapshot, /export function snapshotSvgHtml/);
  assert.match(renderToSvg, /export async function renderMermaidToSvg/);

  // ── createMediaGallery captures the mermaid source ──────────────────────
  assert.match(gallery, /source\?:\s*string/);
  assert.match(gallery, /mdnMermaidSource/);
});

test('mermaidRenderToSvg uses off-DOM render with a scratch node and does not mutate document body', async () => {
  const source = await read('ui/src/components/Content/enhancements/mermaidRenderToSvg.ts');
  assert.match(source, /export async function renderMermaidToSvg/);
  assert.match(source, /createElement\(['"]div['"]\)/);
  assert.match(source, /scratchNode/);
  assert.match(source, /\.textContent\s*=\s*args\.source/);
  assert.match(source, /dataset\.originalCode/);
});
