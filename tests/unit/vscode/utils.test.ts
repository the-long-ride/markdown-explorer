import { describe, expect, test } from 'vitest';
import { escHtml, escAttr, slugify, shortId, renderButton } from '../../../vscode/src/utils';

describe('escHtml', () => {
  test('escapes all four special HTML characters', () => {
    expect(escHtml('<div class="test">&')).toBe('&lt;div class=&quot;test&quot;&gt;&amp;');
  });

  test('returns unchanged string when no special chars', () => {
    expect(escHtml('hello world')).toBe('hello world');
  });

  test('handles empty string', () => {
    expect(escHtml('')).toBe('');
  });

  test('handles multiple occurrences', () => {
    expect(escHtml('<<>>"&')).toBe('&lt;&lt;&gt;&gt;&quot;&amp;');
  });
});

describe('escAttr', () => {
  test('escapes backslash and single quote', () => {
    expect(escAttr("it's \\done\\")).toBe("it\\'s \\\\done\\\\");
  });

  test('returns unchanged when no special chars', () => {
    expect(escAttr('plain text')).toBe('plain text');
  });

  test('handles empty string', () => {
    expect(escAttr('')).toBe('');
  });
});

describe('slugify', () => {
  test('converts heading to URL-friendly slug', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
  });

  test('strips non-word characters', () => {
    expect(slugify('foo@bar#baz')).toBe('foobarbaz');
  });

  test('collapses multiple hyphens', () => {
    expect(slugify('foo---bar')).toBe('foo-bar');
  });

  test('converts leading and trailing spaces to hyphens', () => {
    expect(slugify('  spaced out  ')).toBe('-spaced-out-');
  });

  test('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});

describe('shortId', () => {
  test('generates id with default prefix', () => {
    const id = shortId();
    expect(id).toMatch(/^id_\w{6}$/);
  });

  test('generates id with custom prefix', () => {
    const id = shortId('html');
    expect(id).toMatch(/^html_\w{6}$/);
  });

  test('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => shortId()));
    expect(ids.size).toBe(100);
  });
});

describe('renderButton', () => {
  test('renders full button with icon, label, and tooltip', () => {
    const html = renderButton({
      onClick: 'foo()',
      label: 'Click',
      tooltip: 'Tooltip text',
      iconHtml: '<svg></svg>',
      onlyIcon: false,
    });
    expect(html).toContain('onclick="foo()"');
    expect(html).toContain('btn-label');
    expect(html).toContain('Click');
    expect(html).toContain('<span class="tooltip-text">Tooltip text</span>');
    expect(html).toContain('class="tooltip-container"');
  });

  test('renders icon-only button when onlyIcon is true', () => {
    const html = renderButton({
      onClick: 'UI.copyCode(this)',
      label: 'Copy',
      iconHtml: '<svg></svg>',
      onlyIcon: true,
    });
    expect(html).toContain('<svg></svg>');
    expect(html).not.toContain('btn-label');
  });

  test('falls back to label as tooltip when no tooltip provided', () => {
    const html = renderButton({
      onClick: 'bar()',
      label: 'My Button',
    });
    expect(html).toContain('<span class="tooltip-text">My Button</span>');
  });

  test('adds id attribute when provided', () => {
    const html = renderButton({
      id: 'btn-1',
      onClick: 'run()',
      label: 'Run',
    });
    expect(html).toContain('id="btn-1"');
  });

  test('adds disabled attribute when disabled', () => {
    const html = renderButton({
      onClick: 'nop()',
      label: 'Nop',
      disabled: true,
    });
    expect(html).toContain(' disabled');
  });

  test('adds custom className', () => {
    const html = renderButton({
      className: 'mdn-copy-btn extra',
      onClick: 'copy()',
      label: 'Copy',
    });
    expect(html).toContain('mdn-copy-btn extra');
  });

  test('adds tooltip position data attribute', () => {
    const html = renderButton({
      onClick: 'tooltip()',
      label: 'Test',
      tooltipPos: 'above',
    });
    expect(html).toContain('data-tooltip-pos="above"');
  });

  test('adds onkeydown handler when provided', () => {
    const html = renderButton({
      onClick: 'click()',
      label: 'Test',
      onKeyDown: 'UI.handleKey(this,event)',
    });
    expect(html).toContain('onkeydown="UI.handleKey(this,event)"');
  });

  test('with onlyIcon=false shows both icon and label', () => {
    const html = renderButton({
      onClick: 'btn()',
      label: 'visible',
      iconHtml: '<i></i>',
      onlyIcon: false,
    });
    expect(html).toContain('btn-label');
    expect(html).toContain('btn-icon');
  });

  test('escapes HTML in tooltip text', () => {
    const html = renderButton({
      onClick: 'x()',
      label: '<script>',
    });
    expect(html).toContain('<span class="tooltip-text">&lt;script&gt;</span>');
  });

  test('classes includes tooltip-container even with custom class', () => {
    const html = renderButton({
      className: 'custom',
      onClick: 'go()',
      label: 'Go',
    });
    expect(html).toContain('class="custom tooltip-container"');
  });

  test('onlyIcon with no iconHtml renders empty content', () => {
    const html = renderButton({
      onClick: 'bare()',
      label: 'Bare',
      onlyIcon: true,
    });
    expect(html).not.toContain('btn-label');
    expect(html).not.toContain('btn-icon');
  });
});