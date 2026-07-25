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
