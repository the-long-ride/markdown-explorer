import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');
const read = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('website homepage positioning', () => {
  test('leads with the human benefit instead of a feature inventory', () => {
    const html = read('website/index.html');
    const english = read('website/i18n/en.js');

    expect(html).toContain('id="hero-title"');
    expect(english).not.toMatch(
      /heroCopy:[\s\S]{0,500}exact search jumps,[\s\S]{0,500}Theme Remix/,
    );
  });

  test('puts the zero-install browser experience first', () => {
    const html = read('website/index.html');

    expect(html).toMatch(
      /class="button primary hero-primary-cta"[\s\S]*?href="app\/\?mode=file"/,
    );
    expect(html).toContain('data-i18n="heroTryFile"');
    expect(html).toContain('data-i18n="heroExploreDemo"');
  });

  test('shows the real product and concise trust proof above the fold', () => {
    const html = read('website/index.html');

    expect(html).toContain('class="hero-product-preview"');
    expect(html).toContain('media/demo/Homepage.png');
    expect(html).toContain('data-i18n="heroProofPrivate"');
    expect(html).toContain('data-i18n="heroProofOpen"');
    expect(html).toContain('data-i18n="heroProofEverywhere"');
  });

  test('falls back to English for newly introduced localization keys', () => {
    const i18n = read('website/i18n.js');

    expect(i18n).toContain('window.LANGS.en');
    expect(i18n).toContain('...window.LANGS.en');
  });

  test('includes responsive styles for the product preview and proof row', () => {
    const base = read('website/styles/base.part1.css');
    const responsive = read('website/styles/responsive.css');

    expect(base).toContain('.hero-product-preview');
    expect(base).toContain('.hero-proof-list');
    expect(responsive).toContain('.hero-product-preview');
  });
});
