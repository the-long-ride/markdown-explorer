import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

async function exists(path) {
  try { await access(new URL(path, root)); return true; } catch { return false; }
}

test('Mermaid uses the baseline renderer without custom theme/layout modules', async () => {
  assert.equal(await exists('ui/src/components/Content/enhancements/mermaidTheme.ts'), false);
  assert.equal(await exists('ui/src/components/Content/enhancements/mermaidLayout.ts'), false);
  const source = await read('ui/src/components/Content/enhancements/mermaidRendering.ts');
  assert.match(source, /theme:\s*options\.isDark\s*\?\s*['"]dark['"]\s*:\s*['"]default['"]/);
  assert.doesNotMatch(source, /buildMermaidThemeVariables|detectMermaidDiagramKind|mdnMermaidFit|waitForDocumentFonts/);
});

test('Mermaid stylesheet has no diagram-kind or schedule-scroll customization', async () => {
  const css = await read('ui/src/styles/global/global-switch-tooltip-diff.css');
  assert.doesNotMatch(css, /data-mdn-mermaid-kind|data-mdn-mermaid-fit/);
  assert.match(css, /\.mdn-mermaid-wrap\s*\{[\s\S]*background:\s*transparent/);
});
