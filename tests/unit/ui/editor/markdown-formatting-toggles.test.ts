import { describe, expect, it } from 'vitest';
import { applyMarkdownFormat } from '../../../../ui/src/editor/markdownFormatting';

const at = (source: string, text: string) => { const from = source.indexOf(text); return { from, to: from + text.length }; };

describe('markdown formatting toggles', () => {
  it('unwraps surrounding bold, italic and underline markers', () => {
    expect(applyMarkdownFormat('a **b** c', at('a **b** c', 'b'), 'bold').source).toBe('a b c');
    expect(applyMarkdownFormat('a *b* c', at('a *b* c', 'b'), 'italic').source).toBe('a b c');
    expect(applyMarkdownFormat('a *b* c', at('a *b* c', '*b*'), 'italic').source).toBe('a b c');
    expect(applyMarkdownFormat('a **b** c', at('a **b** c', 'b'), 'italic').source).not.toBe('a b c');
    expect(applyMarkdownFormat('a <u>b</u> c', at('a <u>b</u> c', 'b'), 'underline').source).toBe('a b c');
    expect(applyMarkdownFormat('a <U>b</U> c', at('a <U>b</U> c', '<U>b</U>'), 'underline').source).toBe('a b c');
  });

  it('formats headings 4-6 and skips blank lines in block formats', () => {
    expect(applyMarkdownFormat('x', { from: 0, to: 1 }, 'heading-4').source).toBe('#### x');
    expect(applyMarkdownFormat('x', { from: 0, to: 1 }, 'heading-5').source).toBe('##### x');
    expect(applyMarkdownFormat('x', { from: 0, to: 1 }, 'heading-6').source).toBe('###### x');
    const multi = 'a\n\nb';
    for (const command of ['quote', 'bullet-list', 'numbered-list', 'task-list'] as const) {
      expect(applyMarkdownFormat(multi, { from: 0, to: multi.length }, command).source.split('\n')[1]).toBe('');
    }
    expect(applyMarkdownFormat('', { from: 0, to: 0 }, 'code-block').source).toBe('```\n\n```');
    expect(applyMarkdownFormat('code', { from: 0, to: 4 }, 'code-block').source).toBe('```\ncode\n```');
  });
});
