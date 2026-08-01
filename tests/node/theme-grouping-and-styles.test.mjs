import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readProjectSource } from './read-refactored-source.mjs';

const read = readProjectSource;

test('theme picker exposes at most three translated group cards', async () => {
  const [picker, translations] = await Promise.all([
    read('ui/src/components/Settings/ThemeStylePicker.tsx'),
    read('ui/src/contexts/translations.ts'),
  ]);
  assert.match(picker, /data-theme-group="themes"/);
  assert.match(picker, /data-theme-group="pets"/);
  assert.match(picker, /data-theme-group="custom"/);
  assert.doesNotMatch(picker, />Custom themes</);
  assert.doesNotMatch(picker, /aria-label="Pet sub-theme"/);
  for (const key of ['themesLabel', 'themesDesc', 'themesMenuLabel', 'chooseTheme', 'customThemesLabel', 'customThemesDesc', 'customThemesMenuLabel', 'chooseCustomTheme']) {
    assert.match(translations, new RegExp(`${key}: string`));
  }
});

test('supported theme ids and translated names are registered', async () => {
  const [types, constants, translations] = await Promise.all([
    read('ui/src/themeTypes.ts'),
    read('ui/src/contexts/appStateConstants.ts'),
    read('ui/src/contexts/translationsData.ts'),
  ]);
  assert.match(types, /'neon-voltage'/);
  assert.match(types, /'raw-grid'/);
  assert.match(constants, /id: 'neon-voltage'/);
  assert.match(constants, /id: 'raw-grid'/);
  assert.doesNotMatch(constants, /id: 'glass'/);
  assert.ok(
    constants.indexOf("id: 'pet-k-ink'") < constants.indexOf("id: 'pet-white-shiba'"),
    'K-Ink must lead pet theme options',
  );
  for (const key of ['neonVoltageLabel', 'neonVoltageDesc', 'rawGridLabel', 'rawGridDesc', 'whiteShibaLabel', 'kInkLabel', 'catLabel', 'hamsterLabel', 'corgiLabel', 'legacyBestEffortWarning']) {
    assert.equal((translations.match(new RegExp(`${key}:`, 'g')) ?? []).length, 9, `${key} must exist in all nine locales`);
  }
});

test('new CSS themes and tabs/focus header parity are present', async () => {
  const [globalCss, neon, raw, glassBento, vercel, tokyo, styleTokens, autoLightTokens] = await Promise.all([
    read('ui/src/styles/global.css'),
    read('ui/src/styles/global/global-theme-neon-voltage.css'),
    read('ui/src/styles/global/global-theme-raw-grid.css'),
    read('ui/src/styles/global/global-theme-glass-bento.css'),
    read('ui/src/styles/global/global-theme-vercel.css'),
    read('ui/src/styles/global/global-theme-tokyo-night.css'),
    read('ui/src/styles/tokens/tokens-style-foundation.css'),
    read('ui/src/styles/tokens/tokens-pet-auto-light.css'),
  ]);
  assert.match(globalCss, /global-theme-neon-voltage\.css/);
  assert.match(globalCss, /global-theme-raw-grid\.css/);
  assert.match(neon, /data-theme-style="neon-voltage"/);
  assert.match(raw, /data-theme-style="raw-grid"/);
  assert.match(raw, /\.mdn-body[\s\S]*background(?:-color)?:\s*var\(--bg-s\)/);
  assert.match(raw, /\.switch-slider[\s\S]*border-radius:\s*0/);
  assert.match(raw, /\.scroll-to-top-btn[\s\S]*border-radius:\s*0/);
  assert.match(raw, /\.settings-language-btn[\s\S]*border-radius:\s*0/);
  assert.match(styleTokens, /data-theme-style="neon-voltage"\]\[data-theme="light"\]/);
  assert.match(styleTokens, /data-theme-style="raw-grid"\]\[data-theme="light"\]/);
  assert.match(autoLightTokens, /data-theme-style="neon-voltage"\]\[data-theme="auto"\]/);
  assert.match(autoLightTokens, /data-theme-style="raw-grid"\]\[data-theme="auto"\]/);
  for (const [name, css] of [['glass/bento', glassBento], ['vercel', vercel], ['tokyo', tokyo]]) {
    assert.match(css, /\.app--tab-view \.desktop-tabbar/, `${name} tabs header parity`);
  }
  assert.match(tokyo, /--theme-header-gap:/);
  assert.match(tokyo, /\.sidebar[\s\S]{0,160}var\(--theme-header-gap\)/);
  assert.match(tokyo, /\.toc-panel[\s\S]{0,160}var\(--theme-header-gap\)/);
});
