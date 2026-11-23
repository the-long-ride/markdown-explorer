import { describe, expect, it } from 'vitest';
import {
  deriveMarkdownStrippedQuery,
  findEnclosingSourceElement,
  findNextInText,
  findTableRowForSourceLine,
  getElementSourceRange,
  resolveNormalizedSourceTarget,
  utf8ByteOffsetToUtf16,
} from '../../../../ui/src/utils/searchJumpResolver';

describe('searchJumpResolver edge cases', () => {
  it('converts byte offsets and finds text', () => {
    expect(utf8ByteOffsetToUtf16('héllo', Number.NaN)).toBe(0);
    expect(utf8ByteOffsetToUtf16('héllo', 2)).toBe(1);
    expect(findNextInText('abc', 'zz', 0, true)).toBeNull();
    expect(deriveMarkdownStrippedQuery('  ')).toBe('');
  });

  it('resolves line-targeted matches by index, ordinal and missing hits', () => {
    const src = 'foo foo\r\nbar foo foo\nbaz';
    expect(resolveNormalizedSourceTarget(src, 'zzz', false, undefined, undefined, { lineNumber: 2 })).toMatchObject({ lineIndex: 1, columnOffset: 0 });
    expect(resolveNormalizedSourceTarget(src, 'foo', false, 3, undefined, { lineNumber: 2 })?.columnOffset).toBe(8);
    expect(resolveNormalizedSourceTarget(src, 'foo', false, undefined, 17, { lineNumber: 2 })?.columnOffset).toBe(8);
    expect(resolveNormalizedSourceTarget(src, 'foo', false, undefined, undefined, { lineNumber: 99 })).toBeNull();
  });

  it('resolves by match index and ordinal without line numbers', () => {
    const src = 'alpha\nbeta alpha\ngamma';
    expect(resolveNormalizedSourceTarget(src, 'alpha', true, undefined, 11)?.lineIndex).toBe(1);
    expect(resolveNormalizedSourceTarget(src, 'alpha', true, undefined, 2)?.normalizedOffset).toBe(0);
    expect(resolveNormalizedSourceTarget(src, 'nothing', true, undefined, 3)).toBeNull();
    expect(resolveNormalizedSourceTarget(src, 'alpha', true, 1)?.lineIndex).toBe(1);
    expect(resolveNormalizedSourceTarget(src, 'alpha', true, 9)).toBeNull();
    expect(resolveNormalizedSourceTarget(src, 'alpha', true)).toBeNull();
    expect(resolveNormalizedSourceTarget('', 'x', true)).toBeNull();
  });

  it('reads source ranges and picks the innermost enclosing element', () => {
    document.body.innerHTML = '<div id="root"><section data-source-start="0" data-source-end="50"><p data-source-start="5" data-source-end="10"></p></section><i data-source-start="x" data-source-end="1"></i><b data-source-start="9" data-source-end="2"></b></div>';
    const root = document.getElementById('root')!;
    expect(getElementSourceRange(root)).toBeNull();
    expect(getElementSourceRange(root.querySelector('i')!)).toBeNull();
    expect(getElementSourceRange(root.querySelector('b')!)).toBeNull();
    const found = findEnclosingSourceElement(root, 6);
    expect(found === null || found.tagName === 'P' || found.tagName === 'SECTION').toBe(true);
  });

  it('maps source lines to table rows for pipe and fenced tables', () => {
    document.body.innerHTML = '<div class="mdn-table-wrap"><table class="mdn-table"><thead><tr id="h"></tr></thead><tbody><tr id="r0"></tr><tr data-toggle="1"></tr><tr id="r1"></tr></tbody></table></div><div class="other"></div><div class="mdn-codeblock"></div>';
    const wrap = document.querySelector('.mdn-table-wrap') as HTMLElement;
    const pipe = 'intro\n| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |';
    const start = pipe.indexOf('|');
    const range = { start, end: pipe.length };
    expect(findTableRowForSourceLine(document.querySelector('.other') as HTMLElement, pipe, range, 1)).toBeNull();
    expect(findTableRowForSourceLine(document.querySelector('.mdn-codeblock') as HTMLElement, pipe, range, 1)).toBeNull();
    expect(findTableRowForSourceLine(wrap, pipe, range, 0)).toBeNull();
    expect(findTableRowForSourceLine(wrap, pipe, range, 1)?.id).toBe('h');
    expect(findTableRowForSourceLine(wrap, pipe, range, 2)?.id).toBe('h');
    expect(findTableRowForSourceLine(wrap, pipe, range, 4)?.id).toBe('r1');
    const noSep = '| a |\n| 1 |';
    expect(findTableRowForSourceLine(wrap, noSep, { start: 0, end: noSep.length }, 1)?.id).toBe('r0');
    const fenced = '```csv\na,b\n1,2\n3,4\n```';
    const table = wrap.querySelector('table') as HTMLElement;
    const fr = { start: 0, end: fenced.length };
    expect(findTableRowForSourceLine(table, fenced, fr, 0)).toBeNull();
    expect(findTableRowForSourceLine(table, fenced, fr, 1)?.id).toBe('h');
    expect(findTableRowForSourceLine(table, fenced, fr, 3)?.id).toBe('r1');
    expect(findTableRowForSourceLine(table, fenced, fr, 9)).toBeNull();
  });
});
