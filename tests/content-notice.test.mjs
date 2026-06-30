import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentPath = path.join(__dirname, "..", "ui", "src", "components", "Content", "Content.tsx");
const translationsTypePath = path.join(__dirname, "..", "ui", "src", "contexts", "translations.ts");
const translationsDataPath = path.join(__dirname, "..", "ui", "src", "contexts", "translationsData.ts");
const cssPath = path.join(__dirname, "..", "ui", "src", "styles", "global", "global-markdown-base.css");

async function read(filePath) {
  return readFile(filePath, "utf8");
}

test("stale current-file notice uses translation keys instead of hardcoded copy", async () => {
  const content = await read(contentPath);

  assert.match(content, /previewCopy\.currentFileChangedOnDisk/);
  assert.match(content, /previewCopy\.refreshCurrentFile/);
  assert.match(content, /previewCopy\.currentFileChangedSuffix/);
  assert.doesNotMatch(content, />Current file changed on disk\.<\/span>/);
  assert.doesNotMatch(content, />\s*Refresh\s*</);
});

test("translations declare stale current-file notice copy for all languages", async () => {
  const [translationsType, translationsData] = await Promise.all([
    read(translationsTypePath),
    read(translationsDataPath),
  ]);

  assert.match(translationsType, /currentFileChangedOnDisk: string;/);
  assert.match(translationsType, /refreshCurrentFile: string;/);
  assert.match(translationsType, /currentFileChangedSuffix: string;/);

  const languages = ["en", "vi", "fr", "es", "zh", "no", "ja", "ko", "ru"];
  for (const lang of languages) {
    const start = translationsData.indexOf("\n  " + lang + ": {") + 1;
    assert.ok(start > 0, "missing language block: " + lang);
    const nextStart = languages
      .map((candidate) => candidate === lang ? -1 : translationsData.indexOf("\n  " + candidate + ": {", start + 1) + 1)
      .filter((index) => index > start)
      .sort((a, b) => a - b)[0] ?? translationsData.length;
    const block = translationsData.slice(start, nextStart);
    assert.match(block, /documentPreview:\s*{[\s\S]*?currentFileChangedOnDisk:/, `missing currentFileChangedOnDisk for ${lang}`);
    assert.match(block, /documentPreview:\s*{[\s\S]*?refreshCurrentFile:/, `missing refreshCurrentFile for ${lang}`);
    assert.match(block, /documentPreview:\s*{[\s\S]*?currentFileChangedSuffix:/, `missing currentFileChangedSuffix for ${lang}`);
  }
});

test("stale current-file notice stays sticky and theme-aware", async () => {
  const css = await read(cssPath);

  assert.match(css, /\.current-file-change-notice\s*{[^}]*position:\s*sticky;/s);
  assert.match(css, /\.current-file-change-notice\s*{[^}]*top:\s*0/s);
  assert.match(css, /\.current-file-change-notice\s*{[^}]*z-index:/s);
  assert.match(css, /\.current-file-change-notice\s*{[^}]*background:\s*color-mix\(/s);
});


test("toolbar action menu grows to localized label width and keeps labels on one line", async () => {
  const toolbarCssPath = path.join(__dirname, "..", "ui", "src", "styles", "global", "global-topbar-tabs.css");
  const toolbarCss = await read(toolbarCssPath);

  assert.match(toolbarCss, /\.toolbar-action-menu__panel\s*{[^}]*width:\s*max-content;/s);
  assert.match(toolbarCss, /\.toolbar-action-menu__panel\s*{[^}]*max-width:\s*calc\(100vw - 16px\);/s);
  assert.match(toolbarCss, /\.toolbar-action-menu__item \.btn-label\s*{[^}]*white-space:\s*nowrap;/s);
});
