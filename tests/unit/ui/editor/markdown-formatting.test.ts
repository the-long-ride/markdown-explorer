import { describe, expect, it } from 'vitest';
import { applyMarkdownFormat } from '../../../../ui/src/editor/markdownFormatting';

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
});
