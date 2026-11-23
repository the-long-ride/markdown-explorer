import { expect, test } from 'vitest';
import { renderCodeBlock } from '../../../vscode/src/markdown/codeRenderer';
import { buildHtmlPreviewDocument, hasRenderableHtmlContent } from '../../../vscode/src/markdown/htmlPreviewDocument';
import { renderInteractiveTable } from '../../../vscode/src/markdown/tableRenderer';

test('renders HTML preview controls but initially shows source for non-rendering markup or disabled previews', () => {
  const render = (content: string, defaultHtmlPreview?: boolean) =>
    renderCodeBlock({ type: 'code', lang: 'html', content }, { theme: 'light', defaultHtmlPreview });
  const html = render('<p>Preview</p>');
  expect(html).toContain('data-mode="preview"');
  expect(html).toContain('data-theme=&quot;light&quot;');
  expect(html).toContain('data-mdn-inline-resize');
  expect(html).toContain('Open in browser');
  expect(html).toContain('Open as modal');
  expect(render('<!DOCTYPE html><html><head><title>Only metadata</title></head></html>')).toContain('data-mode="code"');
  expect(render('<p>Visible but disabled</p>', false)).toContain('data-mode="code"');
});

test.each([
  ['', false], [' <!-- a comment --> ', false],
  ['<style>p{}</style><script>let a=1</script><template><p>a</p></template>', false],
  ['<!DOCTYPE html><html><head><title>Head</title></head><body><meta charset="utf-8"></body></html>', false],
  ['<img src="photo.jpg">', true], ['<my-widget></my-widget>', true],
  ['<body>Text</body>', true], ['</stray>', false], ['<script src="one.js">', false],
])('recognizes whether an HTML block has visible content: %s', (content, expected) => {
  expect(hasRenderableHtmlContent(content)).toBe(expected);
});

test('renders standalone documents with an escaped base URL and without iframe messaging', () => {
  const document = buildHtmlPreviewDocument('<p>Body</p>', {
    target: 'external', baseHref: 'https://example.test/?x="a"&y=<b>', theme: '',
  });
  expect(document).toContain('<base href="https://example.test/?x=&quot;a&quot;&amp;y=&lt;b&gt;" />');
  expect(document).toContain('data-theme="auto"');
  expect(document).toContain('background: var(--bg)');
  expect(document).toContain('<p>Body</p>');
  expect(document).not.toContain('data-mdn-inline-resize');
  expect(buildHtmlPreviewDocument('Hello')).toContain('background: transparent');
});

test('renders long CSV as a collapsed searchable table and ragged TSV as source with warnings', () => {
  const csv = ['Group,Number', ...Array.from({ length: 24 }, (_, i) => `${i % 2 ? 'A' : 'B'},${i * i}`)].join('\n');
  const preview = renderCodeBlock({ type: 'code', lang: 'csv', content: csv }, {});
  expect(preview).toContain('data-mode="preview" data-collapsed="true"');
  expect(preview).toContain('class="mdn-th has-filter" data-col="0"');
  expect(preview).toContain('data-intelligent-align="right"');
  expect(preview).toContain('mdn-table-toggle-btn');
  expect(preview).toContain('code-delimited-column--1');
  const source = renderCodeBlock({
    type: 'code', lang: 'tsv', meta: 'header=false', content: 'x\ty\nz\n"unclosed',
  }, { defaultCsvPreview: false, isMdx: true });
  expect(source).toContain('data-mode="code"');
  expect(source).toContain('data-i18n-preview-key="tsvPreviewTitle"');
  expect(source).toContain('csvUnevenRows');
  expect(source).toContain('csvMalformedQuote');
});

test('renders explicit table alignment and blank cells without collapsing a short table', () => {
  const html = renderInteractiveTable({ headers: ['**Label**', 'Value'], rows: [['Only label']], align: ['center', null] });
  expect(html).toContain('<strong>Label</strong>');
  expect(html).toContain('<td data-col-align="center" style="text-align:center" data-intelligent-align="left">Only label</td><td data-intelligent-align="left"></td>');
  expect(html).not.toContain('has-filter');
  expect(html).not.toContain('mdn-table-toggle-btn');
});

test('does not add filters for empty, identical, unique or long-text columns', () => {
  const rows = Array.from({ length: 12 }, (_, i) => [
    '', 'same', `unique-${i}`, `${'a'.repeat(45)}${i % 2}`, `value-${i % 11}`,
  ]);
  const html = renderInteractiveTable({ headers: ['Empty', 'Fixed', 'Unique', 'Long', 'Many'], rows });
  expect(html).not.toContain('has-filter');
});

test('auto-detects Mermaid after a BOM, frontmatter and comments, but not a comment-only block', () => {
  const render = (content: string) => renderCodeBlock({ type: 'code', lang: '', content }, 'auto');
  expect(render('\uFEFF\n---\ntitle: Diagram\n---\n%% comment\nflowchart LR\nA-->B')).toContain('mdn-mermaid-wrap');
  expect(render('  \n%% only a comment\n')).not.toContain('mdn-mermaid-wrap');
});
