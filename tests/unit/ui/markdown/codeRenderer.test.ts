import { describe, it, expect, vi } from 'vitest';
import { renderCodeBlock } from '../../../../ui/src/markdown/codeRenderer';

describe('markdown/codeRenderer', () => {
  it('renders mermaid block when lang is mermaid', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'mermaid', content: 'graph TD\n  A-->B' }, 'auto');
    expect(html).toContain('mdn-mermaid-wrap');
    expect(html).toContain('mermaid');
    expect(html).toContain('graph TD');
  });

  it('renders mermaid when lang is text and first word is mermaid keyword', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'text', content: 'flowchart TD\n  A-->B' }, 'auto');
    expect(html).toContain('mdn-mermaid-wrap');
  });

  it('renders mermaid when lang is empty and first word is mermaid keyword', () => {
    const html = renderCodeBlock({ type: 'code', lang: '', content: 'sequenceDiagram\n  A->>B' }, 'auto');
    expect(html).toContain('mdn-mermaid-wrap');
  });

  it('does not render mermaid for non-mermaid text lang', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'text', content: 'echo hello' }, 'auto');
    expect(html).not.toContain('mdn-mermaid-wrap');
  });

  it('detects all mermaid keywords', () => {
    const keywords = [
      'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram',
      'stateDiagram-v2', 'erDiagram', 'journey', 'gantt', 'pie', 'quadrantChart',
      'xychart-beta', 'mindmap', 'timeline', 'gitGraph', 'sankey-beta',
      'block', 'block-beta', 'packet', 'packet-beta', 'kanban', 'architecture',
      'architecture-beta', 'zenuml', 'requirementDiagram', 'info',
      'C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment',
    ];
    for (const kw of keywords) {
      const html = renderCodeBlock({ type: 'code', lang: '', content: kw }, 'auto');
      expect(html).toContain('mdn-mermaid-wrap');
    }
  });

  it('renders HTML block with iframe and code view', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'html', content: '<h1>Hello</h1>' }, 'auto');
    expect(html).toContain('mdn-html-preview-wrap');
    expect(html).toContain('iframe');
    expect(html).toContain('srcdoc');
    expect(html).toContain('mdn-html-preview-iframe');
  });

  it('sets preview mode when HTML has visible body content', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'html', content: '<h1>Hello</h1>' }, 'auto');
    expect(html).toContain('data-mode="preview"');
  });

  it('sets code mode when HTML only has scripts/styles', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'html', content: '<script>alert(1)</script>' }, 'auto');
    expect(html).toContain('data-mode="code"');
    expect(html).toContain('Show Preview');
  });

  it('renders HTML block with theme in srcdoc', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'html', content: '<p>test</p>' }, 'dark');
    expect(html).toContain('srcdoc');
  });

  it('renders HTML block with line numbers', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'html', content: 'line1\nline2\nline3' }, 'auto');
    expect(html).toContain('mdn-codeblock-gutter');
    expect(html).toContain('data-line="1"');
    expect(html).toContain('data-line="3"');
  });

  it('renders HTML block without line numbers for empty content', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'html', content: '   ' }, 'auto');
    expect(html).not.toContain('mdn-codeblock-gutter');
  });

  it('shows collapse button for HTML with > 20 lines', () => {
    const content = Array.from({ length: 21 }, (_, i) => `line${i + 1}`).join('\n');
    const html = renderCodeBlock({ type: 'code', lang: 'html', content }, 'auto');
    expect(html).toContain('mdn-codeblock-toggle-btn');
    expect(html).toContain('data-collapsed="true"');
  });

  it('renders default code block with highlighting', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'javascript', content: 'const x = 1;' }, 'auto');
    expect(html).toContain('mdn-codeblock');
    expect(html).toContain('language-javascript');
    expect(html).toContain('hl-kw');
  });

  it('renders terminal commands with semantic token classes', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'bash', content: 'npm --help' }, 'auto');
    expect(html).toContain('<span class="hl-cmd">npm</span>');
    expect(html).toContain('<span class="hl-param">--help</span>');
    expect(html).toContain('language-bash');
    expect(html).toContain('mdn-copy-btn');
  });

  it('renders PowerShell commands through terminal highlighting', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'pwsh', content: 'Write-Host -ForegroundColor Green' }, 'auto');
    expect(html).toContain('<span class="hl-cmd">Write-Host</span>');
    expect(html).toContain('<span class="hl-param">-ForegroundColor</span>');
  });

  it('renders code block with line numbers for non-text lang', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'python', content: 'def foo():\n  pass' }, 'auto');
    expect(html).toContain('mdn-codeblock-gutter');
  });

  it('renders code block without line numbers for text lang', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'text', content: 'plain text' }, 'auto');
    expect(html).not.toContain('mdn-codeblock-gutter');
  });

  it('shows collapse button for > 20 lines', () => {
    const content = Array.from({ length: 21 }, (_, i) => `line ${i + 1}`).join('\n');
    const html = renderCodeBlock({ type: 'code', lang: 'js', content }, 'auto');
    expect(html).toContain('mdn-codeblock-toggle-btn');
    expect(html).toContain('data-collapsed="true"');
  });

  it('no collapse button for <= 20 lines', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'js', content: 'short code' }, 'auto');
    expect(html).not.toContain('mdn-codeblock-toggle-btn');
  });

  it('renders code block with copy button', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'js', content: 'code' }, 'auto');
    expect(html).toContain('mdn-copy-btn');
  });

  it('renders HTML block with both copy and toggle buttons', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'html', content: '<p>hi</p>' }, 'auto');
    expect(html).toContain('mdn-copy-btn');
    expect(html).toContain('mdn-toggle-preview-btn');
  });

  it('handles case-insensitive language match', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'JavaScript', content: 'const x = 1;' }, 'auto');
    expect(html).toContain('mdn-codeblock');
  });

  it('renders YAML aliases with syntax highlighting', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'yml', content: 'title: Explorer\nenabled: true' }, 'auto');
    expect(html).toContain('language-yaml');
    expect(html).toContain('hl-attr');
    expect(html).toContain('hl-kw');
  });
});

describe('HTML preview action toolbar', () => {
  it('renders four icon-only actions in browser, modal, toggle, copy order', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'html', content: '<p>hello</p>' }, 'auto');
    const classes = [
      'mdn-open-browser-btn',
      'mdn-open-modal-btn',
      'mdn-toggle-preview-btn',
      'mdn-copy-btn',
    ];
    const positions = classes.map((className) => html.indexOf(className));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html).not.toContain('class="btn-label"');
  });

  it('adds translated-label hooks and accessible English fallbacks to HTML actions', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'html', content: '<p>hello</p>' }, 'auto');
    expect(html).toContain('data-i18n-key="openInBrowser"');
    expect(html).toContain('data-i18n-key="openAsModal"');
    expect(html).toContain('title="Open in browser"');
    expect(html).toContain('aria-label="Open in browser"');
    expect(html).toContain('title="Open as modal"');
    expect(html).toContain('aria-label="Open as modal"');
  });
});


describe('CSV and TSV preview code blocks', () => {
  it('renders CSV as an interactive data table by default', () => {
    const html = renderCodeBlock({
      type: 'code',
      lang: 'csv',
      content: 'Month,Desktop,Website\n2026-01,120,80\n2026-02,140,90',
    }, { defaultCsvPreview: true });

    expect(html).toContain('mdn-csv-preview-wrap');
    expect(html).toContain('data-mode="preview"');
    expect(html).toContain('mdn-table-wrap');
    expect(html).toContain('<span class="mdn-th-text">Month</span>');
    expect(html).toContain('<td>2026-01</td>');
    expect(html).toContain('style="display:none"');
  });

  it('places the preview toggle immediately before the copy button', () => {
    const html = renderCodeBlock({ type: 'code', lang: 'csv', content: 'A,B\n1,2' }, 'auto');
    expect(html.indexOf('mdn-toggle-csv-btn')).toBeGreaterThan(-1);
    expect(html.indexOf('mdn-toggle-csv-btn')).toBeLessThan(html.indexOf('mdn-copy-btn'));
  });

  it('renders source code by default when the CSV preference is disabled', () => {
    const html = renderCodeBlock(
      { type: 'code', lang: 'csv', content: 'A,B\n1,2' },
      { defaultCsvPreview: false },
    );

    expect(html).toContain('data-mode="code"');
    expect(html).toContain('mdn-csv-preview-body" style="display:none"');
    expect(html).toContain('data-i18n-key="showPreview"');
  });

  it('uses TSV metadata, tab parsing, and the TSV translation key', () => {
    const html = renderCodeBlock({
      type: 'code',
      lang: 'tsv',
      meta: 'noheader',
      content: 'January\t42\nFebruary\t57',
    }, 'auto');

    expect(html).toContain('data-code-label="TSV"');
    expect(html).toContain('data-i18n-preview-key="tsvPreviewTitle"');
    expect(html).toContain('<span class="mdn-th-text">A</span>');
    expect(html).toContain('<span class="mdn-th-text">B</span>');
    expect(html).toContain('<td>January</td>');
  });

  it('honors explicit delimiter and header metadata', () => {
    const html = renderCodeBlock({
      type: 'code',
      lang: 'csv',
      meta: 'delimiter=semicolon header',
      content: 'Name;Count\nDesktop;100',
    }, 'auto');

    expect(html).toContain('<span class="mdn-th-text">Name</span>');
    expect(html).toContain('<td>Desktop</td>');
  });

  it('keeps source available and renders a localized warning hook for malformed quotes', () => {
    const html = renderCodeBlock({
      type: 'code',
      lang: 'csv',
      content: 'Name,Description\nDesktop,"unterminated',
    }, 'auto');

    expect(html).toContain('data-i18n-content-key="csvMalformedQuote"');
    expect(html).toContain('mdn-code-source');
    expect(html).toContain('mdn-copy-btn');
  });
});

describe('plain text code block label', () => {
  it('uses PLAIN TEXT with a translation hook for text and untyped fences', () => {
    const typed = renderCodeBlock({ type: 'code', lang: 'text', content: 'hello' }, 'auto');
    const untyped = renderCodeBlock({ type: 'code', lang: '', content: 'hello' }, 'auto');

    for (const html of [typed, untyped]) {
      expect(html).toContain('data-i18n-content-key="plainText"');
      expect(html).toContain('>PLAIN TEXT</span>');
      expect(html).not.toContain('>TEXT</span>');
    }
  });
});
