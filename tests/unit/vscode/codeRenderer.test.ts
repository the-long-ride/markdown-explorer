import { describe, expect, test } from 'vitest';
import { renderCodeBlock } from '../../../vscode/src/markdown/codeRenderer';

describe('renderCodeBlock', () => {
  describe('mermaid detection', () => {
    test('renders mermaid block when lang is mermaid', () => {
      const token = { type: 'code' as const, lang: 'mermaid', content: 'graph TD\nA-->B' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-mermaid-wrap');
      expect(html).toContain('class="mermaid"');
      expect(html).toContain('graph TD');
    });

    test('renders mermaid block when first word is a mermaid keyword and lang is text', () => {
      const token = { type: 'code' as const, lang: 'text', content: 'flowchart LR\nA-->B' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-mermaid-wrap');
    });

    test('renders mermaid block when first word is a mermaid keyword and lang is empty', () => {
      const token = { type: 'code' as const, lang: '', content: 'graph TD\nA-->B' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-mermaid-wrap');
    });

    test('renders mermaid block for C4Container keyword', () => {
      const token = { type: 'code' as const, lang: 'text', content: 'C4Container\nelements' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-mermaid-wrap');
    });

    test('does not render mermaid when lang is js and content contains mermaid keyword', () => {
      const token = { type: 'code' as const, lang: 'javascript', content: 'graph TD\n// comment' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).not.toContain('mdn-mermaid-wrap');
    });
  });

  describe('general code blocks', () => {
    test('renders highlighted code block with language label', () => {
      const token = { type: 'code' as const, lang: 'js', content: 'const x = 1;' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-codeblock');
      expect(html).toContain('language-js');
      expect(html).toContain('const');
    });

    test('renders code block with escapped language name', () => {
      const token = { type: 'code' as const, lang: 'c++', content: 'int main() {}' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('c++');
    });

    test('renders text block without line numbers', () => {
      const token = { type: 'code' as const, lang: 'text', content: 'line 1\nline 2' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('language-text');
      expect(html).not.toContain('mdn-codeblock-gutter');
    });

    test('includes gutter for non-text code blocks with content', () => {
      const token = { type: 'code' as const, lang: 'python', content: 'print("hello")\nprint("world")' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-codeblock-gutter');
      expect(html).toContain('data-line="1"');
      expect(html).toContain('data-line="2"');
    });

    test('does not include gutter when content is empty', () => {
      const token = { type: 'code' as const, lang: 'js', content: '   ' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).not.toContain('mdn-codeblock-gutter');
    });
  });

  describe('code block collapse', () => {
    test('adds collapse toggle for blocks over 20 lines', () => {
      const lines = Array.from({ length: 25 }, (_, i) => `line ${i + 1}`);
      const token = { type: 'code' as const, lang: 'js', content: lines.join('\n') };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-codeblock-toggle-btn');
      expect(html).toContain('data-collapsed="true"');
    });

    test('does not add collapse toggle for blocks with 20 or fewer lines', () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
      const token = { type: 'code' as const, lang: 'js', content: lines.join('\n') };
      const html = renderCodeBlock(token, 'auto');
      expect(html).not.toContain('mdn-codeblock-toggle-btn');
    });
  });

  describe('HTML preview', () => {
    test('renders HTML block with iframe sandbox', () => {
      const token = { type: 'code' as const, lang: 'html', content: '<h1>Hello</h1>' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-html-preview-wrap');
      expect(html).toContain('sandbox="allow-scripts"');
      expect(html).toContain('srcdoc=');
    });

    test('shows code by default when HTML body is empty', () => {
      const token = { type: 'code' as const, lang: 'html', content: '<script>let x=1;</script>' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('data-mode="code"');
    });

    test('shows preview by default when HTML has visible content', () => {
      const token = { type: 'code' as const, lang: 'html', content: '<h1>Hello</h1>' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('data-mode="preview"');
    });

    test('includes toggle button for HTML blocks', () => {
      const token = { type: 'code' as const, lang: 'html', content: '<div>content</div>' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-toggle-preview-btn');
    });

    test('includes copy button in HTML blocks', () => {
      const token = { type: 'code' as const, lang: 'html', content: '<div>text</div>' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-copy-btn');
    });

    test('includes gutter in HTML blocks with content', () => {
      const token = { type: 'code' as const, lang: 'html', content: '<div>line1</div>\n<div>line2</div>' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-codeblock-gutter');
    });

    test('does not include gutter for empty HTML blocks', () => {
      const token = { type: 'code' as const, lang: 'html', content: '' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).not.toContain('mdn-codeblock-gutter');
    });

    test('includes collapse toggle for HTML blocks over 20 lines', () => {
      const lines = Array.from({ length: 25 }, () => '<div></div>');
      const token = { type: 'code' as const, lang: 'html', content: lines.join('\n') };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('mdn-codeblock-toggle-btn');
    });
  });

  describe('custom highlight detection', () => {
    test('adds is-custom-highlighted class when highlighted differs from escaped', () => {
      const token = { type: 'code' as const, lang: 'js', content: 'const x = 1;' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).toContain('is-custom-highlighted');
    });

    test('does not add is-custom-highlighted for non-highlighted code', () => {
      const token = { type: 'code' as const, lang: 'text', content: 'plain text' };
      const html = renderCodeBlock(token, 'auto');
      expect(html).not.toContain('is-custom-highlighted');
    });
  });
});