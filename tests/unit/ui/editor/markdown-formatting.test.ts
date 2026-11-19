import { describe, expect, it } from 'vitest';
import {
  applyMarkdownFormat,
  applyMarkdownLink,
  parseMarkdownLinkSelection,
} from '../../../../ui/src/editor/markdownFormatting';

describe('applyMarkdownFormat', () => {
  it('wraps selections and positions empty wrapper cursors', () => {
    expect(applyMarkdownFormat('text', { from: 0, to: 4 }, 'bold')).toEqual({
      source: '**text**',
      selection: { from: 2, to: 6 },
    });
    expect(applyMarkdownFormat('', { from: 0, to: 0 }, 'bold')).toEqual({
      source: '****',
      selection: { from: 2, to: 2 },
    });
    expect(applyMarkdownFormat('word', { from: 0, to: 4 }, 'italic').source).toBe('*word*');
    expect(applyMarkdownFormat('x', { from: 0, to: 1 }, 'inline-code').source).toBe('`x`');
  });

  it('applies and replaces headings', () => {
    expect(applyMarkdownFormat('title', { from: 0, to: 5 }, 'heading-3').source).toBe('### title');
    expect(applyMarkdownFormat('## title', { from: 0, to: 8 }, 'heading-1').source).toBe('# title');
  });

  it('formats multiple selected lines as quotes and lists without double prefixes', () => {
    expect(applyMarkdownFormat('one\ntwo', { from: 0, to: 7 }, 'bullet-list').source).toBe('- one\n- two');
    expect(applyMarkdownFormat('- one\n* two', { from: 0, to: 11 }, 'numbered-list').source).toBe('1. one\n2. two');
    expect(applyMarkdownFormat('1. one\n2. two', { from: 0, to: 13 }, 'task-list').source).toBe('- [ ] one\n- [ ] two');
    expect(applyMarkdownFormat('one\n> two', { from: 0, to: 9 }, 'quote').source).toBe('> one\n> two');
  });

  it('creates a new formatted prefix on an empty cursor line without selection', () => {
    expect(applyMarkdownFormat('intro\n\noutro', { from: 6, to: 6 }, 'bullet-list')).toEqual({
      source: 'intro\n- \noutro',
      selection: { from: 8, to: 8 },
    });
    expect(applyMarkdownFormat('intro\n\noutro', { from: 6, to: 6 }, 'numbered-list')).toEqual({
      source: 'intro\n1. \noutro',
      selection: { from: 9, to: 9 },
    });
    expect(applyMarkdownFormat('intro\n\noutro', { from: 6, to: 6 }, 'task-list')).toEqual({
      source: 'intro\n- [ ] \noutro',
      selection: { from: 12, to: 12 },
    });
    expect(applyMarkdownFormat('', { from: 0, to: 0 }, 'heading-2')).toEqual({
      source: '## ',
      selection: { from: 3, to: 3 },
    });
    expect(applyMarkdownFormat('', { from: 0, to: 0 }, 'quote')).toEqual({
      source: '> ',
      selection: { from: 2, to: 2 },
    });
  });

  it('inserts links, fenced code blocks, and a table template', () => {
    expect(applyMarkdownFormat('label', { from: 0, to: 5 }, 'link')).toEqual({
      source: '[label](url)',
      selection: { from: 1, to: 6 },
    });
    expect(applyMarkdownFormat('', { from: 0, to: 0 }, 'link')).toEqual({
      source: '[text](url)',
      selection: { from: 1, to: 5 },
    });
    expect(applyMarkdownFormat('const x = 1;', { from: 0, to: 12 }, 'code-block').source)
      .toBe('```\nconst x = 1;\n```');

    const table = applyMarkdownFormat('', { from: 0, to: 0 }, 'table');
    expect(table.source).toBe('| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |');
    expect(table.selection).toEqual({ from: 2, to: 10 });
  });

  it('inserts frontmatter properties block and selects property name', () => {
    const expectedValue =
      'property name - If you use the string/ text, please wrap them with quote block like this';

    const atStart = applyMarkdownFormat('', { from: 0, to: 0 }, 'properties');
    expect(atStart.source).toBe(`---\nname: "${expectedValue}"\n---\n\n`);
    expect(atStart.selection).toEqual({ from: 11, to: 11 + expectedValue.length });
    expect(atStart.source.slice(atStart.selection.from, atStart.selection.to)).toBe(expectedValue);

    const midLine = applyMarkdownFormat('hello', { from: 5, to: 5 }, 'properties');
    expect(midLine.source).toBe(`hello\n---\nname: "${expectedValue}"\n---\n\n`);
    expect(midLine.selection).toEqual({ from: 17, to: 17 + expectedValue.length });
    expect(midLine.source.slice(midLine.selection.from, midLine.selection.to)).toBe(expectedValue);

    const withSelection = applyMarkdownFormat('My Custom Title', { from: 0, to: 15 }, 'properties');
    expect(withSelection.source).toBe('---\nname: "My Custom Title"\n---\n\n');
    expect(withSelection.selection).toEqual({ from: 11, to: 26 });
    expect(withSelection.source.slice(withSelection.selection.from, withSelection.selection.to)).toBe(
      'My Custom Title',
    );
  });

  it('supports underline formatting and unwrapping', () => {
    expect(applyMarkdownFormat('text', { from: 0, to: 4 }, 'underline')).toEqual({
      source: '<u>text</u>',
      selection: { from: 3, to: 7 },
    });
    expect(applyMarkdownFormat('<u>text</u>', { from: 0, to: 11 }, 'underline')).toEqual({
      source: 'text',
      selection: { from: 0, to: 4 },
    });
  });

  it('removes formatting when selected text or lines already have the format', () => {
    // Bold unwrap
    expect(applyMarkdownFormat('**text**', { from: 0, to: 8 }, 'bold')).toEqual({
      source: 'text',
      selection: { from: 0, to: 4 },
    });
    // Italic unwrap
    expect(applyMarkdownFormat('*text*', { from: 0, to: 6 }, 'italic')).toEqual({
      source: 'text',
      selection: { from: 0, to: 4 },
    });
    // Inline-code unwrap
    expect(applyMarkdownFormat('`text`', { from: 0, to: 6 }, 'inline-code')).toEqual({
      source: 'text',
      selection: { from: 0, to: 4 },
    });
    // Heading toggle off when matching current level
    expect(applyMarkdownFormat('## title', { from: 0, to: 8 }, 'heading-2').source).toBe('title');
    // Heading change level when different
    expect(applyMarkdownFormat('## title', { from: 0, to: 8 }, 'heading-3').source).toBe('### title');
    // Quote toggle off
    expect(applyMarkdownFormat('> one\n> two', { from: 0, to: 11 }, 'quote').source).toBe('one\ntwo');
    // Bullet list toggle off
    expect(applyMarkdownFormat('- one\n- two', { from: 0, to: 11 }, 'bullet-list').source).toBe('one\ntwo');
    // Numbered list toggle off
    expect(applyMarkdownFormat('1. one\n2. two', { from: 0, to: 13 }, 'numbered-list').source).toBe('one\ntwo');
    // Task list toggle off
    expect(applyMarkdownFormat('- [ ] one\n- [ ] two', { from: 0, to: 19 }, 'task-list').source).toBe('one\ntwo');
  });

  describe('parseMarkdownLinkSelection', () => {
    it('parses existing markdown link syntax', () => {
      expect(parseMarkdownLinkSelection('[GitHub](https://github.com)')).toEqual({
        label: 'GitHub',
        url: 'https://github.com',
      });
      expect(parseMarkdownLinkSelection('[](https://example.com)')).toEqual({
        label: '',
        url: 'https://example.com',
      });
      expect(parseMarkdownLinkSelection('[Link text]()')).toEqual({
        label: 'Link text',
        url: '',
      });
    });

    it('parses naked URLs, mailto, and anchor fragments', () => {
      expect(parseMarkdownLinkSelection('https://google.com')).toEqual({
        label: '',
        url: 'https://google.com',
      });
      expect(parseMarkdownLinkSelection('  http://example.com/test  ')).toEqual({
        label: '',
        url: 'http://example.com/test',
      });
      expect(parseMarkdownLinkSelection('mailto:test@example.com')).toEqual({
        label: '',
        url: 'mailto:test@example.com',
      });
      expect(parseMarkdownLinkSelection('#section-heading')).toEqual({
        label: '',
        url: '#section-heading',
      });
    });

    it('treats regular text as link label candidate', () => {
      expect(parseMarkdownLinkSelection('Click here')).toEqual({
        label: 'Click here',
        url: '',
      });
      expect(parseMarkdownLinkSelection('')).toEqual({
        label: '',
        url: '',
      });
    });
  });

  describe('applyMarkdownLink', () => {
    it('replaces selection with markdown link formatting and selects label', () => {
      expect(applyMarkdownLink('Visit here today', { from: 6, to: 10 }, 'https://example.com')).toEqual({
        source: 'Visit [here](https://example.com) today',
        selection: { from: 7, to: 11 },
      });
    });

    it('uses provided custom label override', () => {
      expect(applyMarkdownLink('Visit here today', { from: 6, to: 10 }, 'https://example.com', 'Documentation')).toEqual({
        source: 'Visit [Documentation](https://example.com) today',
        selection: { from: 7, to: 20 },
      });
    });

    it('falls back to url if both label and selection are empty', () => {
      expect(applyMarkdownLink('', { from: 0, to: 0 }, 'https://example.com')).toEqual({
        source: '[https://example.com](https://example.com)',
        selection: { from: 1, to: 20 },
      });
    });

    it('falls back to "url" when url is empty or whitespace', () => {
      expect(applyMarkdownLink('hello', { from: 0, to: 5 }, '   ')).toEqual({
        source: '[hello](url)',
        selection: { from: 1, to: 6 },
      });
    });
  });
});
