import { describe, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentPath = path.join(__dirname, '..', '..', '..', '..', 'ui', 'src', 'components', 'Content', 'Content.tsx');
const translationsTypePath = path.join(__dirname, '..', '..', '..', '..', 'ui', 'src', 'contexts', 'translations.ts');
const translationsDataPath = path.join(__dirname, '..', '..', '..', '..', 'ui', 'src', 'contexts', 'translationsData.ts');
const cssPath = path.join(__dirname, '..', '..', '..', '..', 'ui', 'src', 'styles', 'global', 'global-markdown-base.css');

async function read(filePath: string) {
  return readFile(filePath, 'utf8');
}

describe('content-notice', () => {
  test('skips txt code blocks during Highlight.js post-processing', async () => {
    const content = await read(contentPath);

    expect(content).toMatch(/language-\(txt\|text\|plain\|plaintext\)/);
  });

  test('stale current-file notice uses translation keys instead of hardcoded copy', async () => {
    const content = await read(contentPath);

    expect(content).toMatch(/previewCopy\.currentFileChangedOnDisk/);
    expect(content).toMatch(/previewCopy\.refreshCurrentFile/);
    expect(content).toMatch(/previewCopy\.currentFileChangedSuffix/);
    expect(content).not.toMatch(/>Current file changed on disk\.<\/span>/);
    expect(content).not.toMatch(/>\s*Refresh\s*</);
  });

  test('translations declare stale current-file notice copy for all languages', async () => {
    const [translationsType, translationsData] = await Promise.all([
      read(translationsTypePath),
      read(translationsDataPath),
    ]);

    expect(translationsType).toMatch(/currentFileChangedOnDisk: string;/);
    expect(translationsType).toMatch(/refreshCurrentFile: string;/);
    expect(translationsType).toMatch(/currentFileChangedSuffix: string;/);

    const languages = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'];
    for (const lang of languages) {
      const start = translationsData.indexOf('\n  ' + lang + ': {') + 1;
      expect(start).toBeGreaterThan(0);
      const nextStart = languages
        .map((candidate) => candidate === lang ? -1 : translationsData.indexOf('\n  ' + candidate + ': {', start + 1) + 1)
        .filter((index) => index > start)
        .sort((a, b) => a - b)[0] ?? translationsData.length;
      const block = translationsData.slice(start, nextStart);
      expect(block).toMatch(/documentPreview:\s*{[\s\S]*?currentFileChangedOnDisk:/);
      expect(block).toMatch(/documentPreview:\s*{[\s\S]*?refreshCurrentFile:/);
      expect(block).toMatch(/documentPreview:\s*{[\s\S]*?currentFileChangedSuffix:/);
    }
  });

  test('stale current-file notice stays sticky and theme-aware', async () => {
    const css = await read(cssPath);

    expect(css).toMatch(/\.current-file-change-notice\s*{[^}]*position:\s*sticky;/s);
    expect(css).toMatch(/\.current-file-change-notice\s*{[^}]*top:\s*0/s);
    expect(css).toMatch(/\.current-file-change-notice\s*{[^}]*z-index:/s);
    expect(css).toMatch(/\.current-file-change-notice\s*{[^}]*background:\s*color-mix\(/s);
  });

  test('toolbar action menu grows to localized label width and keeps labels on one line', async () => {
    const toolbarCssPath = path.join(__dirname, '..', '..', '..', '..', 'ui', 'src', 'styles', 'global', 'global-topbar-tabs.css');
    const toolbarCss = await read(toolbarCssPath);

    expect(toolbarCss).toMatch(/\.toolbar-action-menu__panel\s*{[^}]*width:\s*max-content;/s);
    expect(toolbarCss).toMatch(/\.toolbar-action-menu__panel\s*{[^}]*max-width:\s*calc\(100vw - 16px\);/s);
    expect(toolbarCss).toMatch(/\.toolbar-action-menu__item \.btn-label\s*{[^}]*white-space:\s*nowrap;/s);
  });

  test('HTML local-first warning dialog shows 1 time per file and experience banner shows 1 time in app opening time', async () => {
    const content = await read(contentPath);

    expect(content).toMatch(/const warningSessionKey = state\.currentFile \?\? '';/);
    expect(content).toMatch(/htmlPreviewWarningSeenRef\.current\.has\(warningSessionKey\)/);
    expect(content).toMatch(/htmlPreviewWarningSeenRef\.current\.add\(warningSessionKey\)/);
    expect(content).not.toMatch(/htmlPreviewWarningSeenRef\.current\.delete/);
    expect(content).toMatch(/htmlPreviewExperienceNoticeSeenRef\.current/);
    expect(content).toMatch(/if\s*\(htmlPreviewExperienceNoticeSeenRef\.current\)\s*return;/);
  });
});
