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

  test('links to the donate page from the header and footer', () => {
    const html = read('website/index.html');
    const donateUrl = 'https://github.com/the-long-ride#donate';
    const headerControls = html.match(
      /<div class="header-controls">[\s\S]*?id="lang-btn"/,
    )?.[0];
    const footerNav = html.match(
      /<nav aria-label="Footer links">[\s\S]*?<\/nav>/,
    )?.[0];

    expect(headerControls).toBeDefined();
    expect(headerControls).toMatch(
      new RegExp(
        `<a[^>]*class="ctrl-btn donate-btn"[^>]*href="${donateUrl}"[^>]*target="_blank"[^>]*rel="noopener"`,
      ),
    );
    expect(headerControls).toContain('data-i18n="navDonate"');
    expect(headerControls).toContain('data-i18n-aria-label="donateAria"');
    expect(footerNav).toBeDefined();
    expect(footerNav).toContain(`href="${donateUrl}"`);
    expect(footerNav).toContain('data-i18n="footerDonate"');

    for (const lang of ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru']) {
      const dictionary = read(`website/i18n/${lang}.js`);
      for (const key of ['navDonate', 'donateAria', 'footerDonate']) {
        expect(dictionary, `${lang}.js is missing ${key}`).toMatch(
          new RegExp(`\\b${key}:\\s*"[^"]+"`),
        );
      }
    }
  });

  test('falls back to English for newly introduced localization keys', () => {
    const i18n = read('website/i18n.js');

    expect(i18n).toContain('window.LANGS.en');
    expect(i18n).toContain('...window.LANGS.en');
  });

  test('includes responsive styles for the product preview and proof row', () => {
    const base = read('website/styles/homepage-hero.css');
    const responsive = read('website/styles/responsive.css');

    expect(base).toContain('.hero-product-preview');
    expect(base).toContain('.hero-proof-list');
    expect(responsive).toContain('.hero-product-preview');
  });

  test('documents the latest HTML, data, workspace, and store work with screenshots', () => {
    const html = read('website/index.html');
    const english = read('website/i18n/en.js');
    const readme = read('README.md');

    expect(html).toContain('data-i18n="latestHtmlTitle"');
    expect(html).toContain('data-i18n="latestDataTitle"');
    expect(html).toContain('data-i18n="latestWorkspaceTitle"');
    expect(html).toContain('data-i18n="latestStoresTitle"');
    expect(html).toContain('Supported-HTML-File-Preview.png');
    expect(html).toContain('chart-for datatable-and-CSV-TSV_2.png');
    expect(html).toContain('VS-Code-style-mutli-workspace-multi-document-tabs.png');
    expect(english).toContain('Run Markdown Explorer on Windows, macOS, and Linux.');

    expect(readme).toContain('## Features');
    expect(readme).toContain('CSV and TSV Code Fences');
    expect(readme).toContain('Open in Browser');
    expect(readme).toContain('Microsoft Store and Ubuntu App Center');
    expect(readme).toContain('media/demo/chart-for datatable-and-CSV-TSV.png');
  });

  test('queries GitHub for real version first and updates all version texts', () => {
    const html = read('website/index.html');
    const script = read('website/script.js');
    const rendering = read('website/site-download-rendering.js');
    const pkg = JSON.parse(read('package.json'));

    expect(html).toContain(`"softwareVersion": "${pkg.version}"`);
    expect(script).toContain('fetchGitHubVersionFallback');
    expect(script).toContain('raw.githubusercontent.com');
    expect(rendering).toContain('updateVersionTexts');
    expect(rendering).toContain('data-version-text');
    expect(rendering).toContain('activeVersion');
    expect(read('website/i18n/en.js')).toContain('Get Markdown Explorer - Current version - <span data-version-text>');
    expect(rendering).not.toContain('download-button-version');
  });
});
