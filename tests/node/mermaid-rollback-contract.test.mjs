import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const exists = (path) => access(new URL(path, root)).then(() => true, () => false);

test('Mermaid renderer uses theme/layout modules and controlled invalidation', async () => {
  assert.equal(await exists('ui/src/components/Content/enhancements/mermaidTheme.ts'), true);
  assert.equal(await exists('ui/src/components/Content/enhancements/mermaidLayout.ts'), true);
  const source = await read('ui/src/components/Content/enhancements/mermaidRendering.ts');
  assert.match(source, /theme:\s*['"]base['"]/);
  assert.match(source, /buildMermaidThemeVariables/);
  assert.match(source, /detectMermaidDiagramKind/);
  assert.match(source, /invalidateMermaidRenderings/);
  assert.match(source, /fontFamily/);
  assert.doesNotMatch(source, /theme:\s*options\.isDark\s*\?/);
});

test('Mermaid stylesheet uses dedicated typography and family-aware overflow with design tokens', async () => {
  const [baseCss, qualityCss] = await Promise.all([
    read('ui/src/styles/global/global-switch-tooltip-diff.css'),
    read('ui/src/styles/global/global-mermaid-rendering.css'),
  ]);
  assert.match(baseCss, /\.mermaid\s*\{[\s\S]*font-family:\s*var\(--font-mermaid\)/);
  assert.match(qualityCss, /data-mdn-mermaid-kind=["']gantt["']/);
  assert.match(qualityCss, /overflow-x:\s*auto/);
  assert.match(qualityCss, /vector-effect:\s*non-scaling-stroke/);
  assert.match(qualityCss, /var\(--tx\)/);
});
