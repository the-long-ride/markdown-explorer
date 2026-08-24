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

  // ── Bug-fix regression guard: the helper call must be deferred to the next
  //    microtask so it reads CSS custom properties AFTER the AppStateProvider
  //    theme-sync effect (which runs in the same commit's passive pass, but as
  //    a PARENT useEffect and therefore AFTER this child effect) has updated
  //    document.documentElement.dataset.theme. Without this defer the re-render
  //    silently keeps the previous palette. Find the theme effect body and
  //    assert it wraps the helper call in queueMicrotask(...).
  const deferredThemeEffect = themeEffects.find((src) =>
    /queueMicrotask\(/.test(src) && /renderMermaidToSvg\(/.test(src),
  );
  assert.ok(
    deferredThemeEffect,
    'expected the theme re-render useEffect to wrap renderMermaidToSvg in queueMicrotask so CSS custom properties are read after the parent theme sync has run',
  );
  // The cancelled flag must be scoped at the outer effect body (its cleanup
  // returns () => { cancelled = true; }) and consulted INSIDE the microtask.
  assert.match(
    deferredThemeEffect,
    /let cancelled = false/,
    'outer effect must declare `let cancelled = false;` for cleanup coordination',
  );
  assert.match(
    deferredThemeEffect,
    /queueMicrotask\(\(\)\s*=>\s*\{[^]*?if \(cancelled\) return/,
    'the queueMicrotask body must early-return when `cancelled` is set (cleanup race protection)',
  );

  // ── Bug B contract: the modal effect must skip the first dep-change after a
  //    NEW gallery opens so the snapshot baked by createMediaGallery (drawn
  //    from the content body's fully-laid-out SVG) is preserved on initial
  //    open. Re-rendering the snapshot on the new gallery's first tick would
  //    either flicker or regress when the off-DOM helper mis-sizes layout-
  //    sensitive kinds — the historical "empty box until user interacts with
  //    zoom/pan" symptom. MediaModal stays mounted across closes/reopens (it
  //    returns null when gallery is null), so a one-shot useRef(true) would
  //    NOT reset between opens — the modal must track the previously-seen
  //    gallery reference instead and skip only when the gallery IDENTITY
  //    changed on this tick.
  assert.match(modal, /prevGalleryRef/, 'modal must declare a prevGalleryRef to track previously-seen gallery identity');
  assert.match(
    deferredThemeEffect,
    /isNewGallery\s*=\s*gallery\s*!==\s*prevGalleryRef\.current/,
    'modal effect must compute isNewGallery = gallery !== prevGalleryRef.current',
  );
  assert.match(
    deferredThemeEffect,
    /if \(isNewGallery\)\s*return/,
    'modal effect must early-return when isNewGallery is true (preserve the snapshot from createMediaGallery)',
  );

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

  // ── Bug B contract: the scratch node must be attached to a hidden off-screen
  //    host appended to document.body so mermaid.run() can measure text via
  //    getBoundingClientRect / getComputedTextLength. A detached scratch node
  //    returns 0 for every measurement → degenerate SVGs for layout-sensitive
  //    kinds (sequence, packet, kanban, pie, quadrant, xychart, zenuml, sankey)
  //    that present as "empty box until user interacts with zoom/pan".
  //    The host must be removed via `finally` so the document body is left
  //    clean even if mermaid.run rejects.
  assert.match(source, /doc\.body\.appendChild\(host\)/, 'helper must append the host to doc.body so mermaid has measurement context');
  assert.match(source, /try\s*\{[^]*?finally\s*\{[^]*?host\.remove\(\)/, 'helper must remove the host in a `finally` block so it is cleaned up even when mermaid.run rejects');
  assert.match(source, /host\.style\.position\s*=\s*['"]absolute['"]/, 'host must be positioned off-screen so it is never painted');
  // visibility:hidden breaks dagre's edge-label measurement (translate(undefined,
  // NaN)); the host is parked at left:-9999px instead and stays visible.
  assert.match(source, /host\.style\.left\s*=\s*['"]-9999px['"]/, 'host must be parked off-screen so the user never sees the scratch render');
  assert.doesNotMatch(source, /host\.style\.visibility\s*=\s*['"]hidden['"]/, 'host must stay visible: hidden subtrees break mermaid label measurements');
});
