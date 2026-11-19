import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scopeCss = await readFile(
  new URL('../../ui/src/styles/global/global-scope-view.css', import.meta.url),
  'utf8',
);

test('Scope View uses the wider desktop surface without changing mobile width', async () => {
  const dialogCss = await readFile(
    new URL('../../ui/src/styles/global/global-dialog-surfaces.css', import.meta.url),
    'utf8',
  );
  assert.match(
    scopeCss,
    /\.scope-view__card\s*\{[\s\S]*?width:\s*min\(1600px,\s*calc\(100vw - 24px\)\)/,
  );
  assert.match(
    dialogCss,
    /\.mdn-app-modal-region \.scope-view__card\s*\{[\s\S]*?height:\s*min\(1120px,\s*calc\(100dvh - var\(--modal-region-top\) - 24px\)\)/,
  );
  assert.match(
    scopeCss,
    /\.scope-view__document\s*\{[\s\S]*?width:\s*min\(100%,\s*1120px\)/,
  );
  assert.match(
    scopeCss,
    /\.scope-view__toc\.toc-panel\s*\{[\s\S]*?display:\s*flex;/,
  );
  assert.match(
    scopeCss,
    /@media \(max-width:\s*720px\)[\s\S]*?\.scope-view__card\s*\{[\s\S]*?width:\s*calc\(100vw - 16px\)/,
  );
});

test('Scope View cyberpunk theme draws the full dual-rail card frame and sharp HUD depth bars', async () => {
  const [globalCss, cyberpunkScopeCss] = await Promise.all([
    readFile(new URL('../../ui/src/styles/global.css', import.meta.url), 'utf8'),
    readFile(
      new URL('../../ui/src/styles/global/global-theme-cyberpunk-scope-view.css', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(globalCss, /@import '\.\/global\/global-theme-cyberpunk-scope-view\.css';/);
  assert.match(cyberpunkScopeCss, /\.scope-view__card\s*\{[\s\S]*?padding:\s*2px\s*!important;/);
  assert.match(cyberpunkScopeCss, /\.scope-view__card::after\s*\{[\s\S]*?z-index:\s*20;/);
  assert.match(cyberpunkScopeCss, /\.scope-view__depth-segment\s*\{[\s\S]*?border-radius:\s*0\s*!important;/);
  assert.match(cyberpunkScopeCss, /\.scope-view__open-file\s*\{[\s\S]*?box-shadow:\s*none\s*!important;/);
});
