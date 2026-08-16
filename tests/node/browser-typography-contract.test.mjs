import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('web and chromium runtimes expose Typography and apply imported fonts without system font enumeration', async () => {
  const [modal, effects, applier] = await Promise.all([
    read('ui/src/components/Settings/SettingsModal.tsx'),
    read('ui/src/contexts/useAppStateEffects.ts'),
    read('ui/src/desktop/fonts/applyDesktopTypography.ts'),
  ]);

  assert.match(modal, /supportsTypography\s*=.*appRuntime\s*===\s*["']chrome["']/s);
  assert.match(effects, /typographyRuntime\s*=.*appRuntime\s*===\s*["']chrome["']/s);
  assert.match(effects, /command:\s*["']listDesktopFonts["']/);
  assert.match(applier, /parsed\.protocol\s*===\s*["']blob:["']/);
  assert.match(applier, /url\.startsWith\(["']blob:["']\)\s*\?\s*["']["']/);
});

test('both browser hosts implement the existing desktop font message protocol', async () => {
  const [chromeHost, webHost, fontHost] = await Promise.all([
    read('chromium-xtension/src/chrome-host.ts'),
    read('website-app/src/web-host.ts'),
    read('chromium-xtension/src/browser-font-host.ts'),
  ]);

  for (const source of [chromeHost, webHost]) {
    assert.match(source, /handleBrowserFontHostCommand/);
  }
  assert.ok(
    webHost.indexOf('handleBrowserFontHostCommand(msg, send)') < webHost.indexOf("if (mode === 'test')"),
    'web demo font commands must run in both test and file modes',
  );
  for (const command of ['listDesktopFonts', 'importDesktopFonts', 'removeImportedDesktopFont']) {
    assert.match(fontHost, new RegExp(command));
  }
  assert.match(fontHost, /desktopFontsResult/);
});

test('browser font service is imported-only and accepts common web font files', async () => {
  const source = await read('chromium-xtension/src/browser-font-service.ts');
  assert.match(source, /ttf/);
  assert.match(source, /otf/);
  assert.match(source, /woff/);
  assert.match(source, /woff2/);
  assert.match(source, /indexedDB/);
  assert.doesNotMatch(source, /queryLocalFonts|localFonts/i);
});
