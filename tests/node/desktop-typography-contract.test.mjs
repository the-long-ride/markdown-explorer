import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

async function exists(path) {
  try {
    await access(new URL(path, root));
    return true;
  } catch {
    return false;
  }
}

test('VS Code Edit capability is enabled for an active current file', async () => {
  const source = await read('ui/src/components/Topbar/Topbar.tsx');
  assert.match(source, /canEdit=\{[^}]*appRuntime\s*===\s*['"]vscode['"]/s);
  assert.match(source, /canEdit=\{[^}]*!!state\.currentFile/s);

  const panel = await read('vscode/src/core/panel.ts');
  assert.match(panel, /case ['"]openInEditor['"]/);
  assert.match(panel, /workspace\.openTextDocument\(msg\.path\)/);
  assert.match(panel, /window\.showTextDocument/);
});

test('desktop bundle contains only the two JetBrains Mono variable font files', async () => {
  const fontDir = new URL('ui/assets/fonts/JetBrainsMono/', root);
  assert.equal(await exists('ui/assets/fonts/CascadiaCode/'), false, 'Cascadia Code assets must be removed');
  assert.equal(await exists('ui/assets/fonts/JetBrainsMono/'), true, 'JetBrains Mono directory must exist');
  const names = (await readdir(fontDir)).sort();
  assert.deepEqual(names.filter((name) => name.endsWith('.ttf')), [
    'JetBrainsMono-Italic-VariableFont_wght.ttf',
    'JetBrainsMono-VariableFont_wght.ttf',
  ]);
  assert.ok(names.includes('OFL.txt'), 'JetBrains Mono OFL license must ship with the desktop font assets');
});

test('bundled JetBrains Mono is applied only to desktop runtimes', async () => {
  const fonts = await read('ui/src/styles/fonts.css');
  const tokens = await read('ui/src/styles/tokens/tokens-base-themes.css');
  assert.match(fonts, /font-family:\s*['"]JetBrains Mono['"]/);
  assert.match(fonts, /JetBrainsMono-VariableFont_wght\.ttf/);
  assert.match(fonts, /JetBrainsMono-Italic-VariableFont_wght\.ttf/);
  assert.match(fonts, /font-weight:\s*100 800/);
  assert.doesNotMatch(fonts, /CascadiaCode/);

  const desktopBlock = tokens.match(/body\.is-desktop,[\s\S]*?body\.is-tauri[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(desktopBlock, /JetBrains Mono/);
  assert.match(desktopBlock, /body\.is-tauri/);
  const chromeBlock = tokens.match(/body\.is-chrome-ext[\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(chromeBlock, /JetBrains Mono/);
});

test('JetBrains font copying and inline faces are desktop-only without removing existing UI fonts', async () => {
  const vite = await read('ui/vite.config.ts');
  assert.match(vite, /name:\s*['"]copy-fonts['"]/);
  assert.match(vite, /!isDesktop\s*&&\s*entry\.name\s*===\s*['"]JetBrainsMono['"]/);
  assert.match(vite, /if\s*\(!isDesktop\)[\s\S]*?JetBrains Mono/);
});

test('critical HTML preload references only JetBrains variable files for desktop mono assets', async () => {
  const html = await read('ui/index.html');
  assert.match(html, /JetBrainsMono-VariableFont_wght\.ttf/);
  assert.match(html, /JetBrainsMono-Italic-VariableFont_wght\.ttf/);
  assert.doesNotMatch(html, /assets\/fonts\/CascadiaCode/);
});

test('Tauri builds use the dedicated tauri UI mode and runtime detection', async () => {
  const [rootPkg, uiPkg, main] = await Promise.all([
    read('package.json'),
    read('ui/package.json'),
    read('ui/src/main.tsx'),
  ]);
  assert.match(rootPkg, /"build:ui:tauri"/);
  assert.match(rootPkg, /start:tauri[\s\S]*build:ui:tauri/);
  assert.match(rootPkg, /build:tauri[\s\S]*build:ui:tauri/);
  assert.match(uiPkg, /"build:tauri"/);
  assert.match(main, /__TAURI__/);
  assert.match(main, /is-tauri/);
  assert.match(main, /is-desktop/);
});

test('desktop typography exposes independent role variables and markdown selectors consume them', async () => {
  const [apply, markdown, tokens] = await Promise.all([
    read('ui/src/desktop/fonts/applyDesktopTypography.ts'),
    read('ui/src/styles/global/global-markdown-foundation.css'),
    read('ui/src/styles/tokens/tokens-base-themes.css'),
  ]);
  for (const variable of ['--font-ui', '--font-body', '--font-heading', '--font-quote', '--font-mono']) {
    assert.match(apply, new RegExp(variable));
  }
  for (const variable of ['--font-ui-weight', '--font-body-weight', '--font-heading-weight', '--font-quote-weight', '--font-mono-weight']) {
    assert.match(apply, new RegExp(variable));
  }
  assert.match(markdown, /\.mdn-body\s*\{[\s\S]*font-family:\s*var\(--font-body\)/);
  assert.match(markdown, /\.mdn-body h1[\s\S]*font-family:\s*var\(--font-heading\)/);
  assert.match(markdown, /\.mdn-blockquote\s*\{[\s\S]*font-family:\s*var\(--font-quote\)/);
  assert.match(tokens, /--font-body:/);
  assert.match(tokens, /--font-heading:/);
  assert.match(tokens, /--font-quote:/);
});
