import { describe, expect, it } from 'vitest';
import {
  detectDelimiter,
  excelColumnName,
  inferHeader,
  parseDelimitedFenceInfo,
  parseDelimitedText,
  tokenizeDelimitedSource,
} from '../../../../ui/src/markdown/delimitedText';

describe('delimitedText edge cases', () => {
  it('tokenizes BOMs, CRLF line endings and empty sources', () => {
    expect(tokenizeDelimitedSource('', ',')).toEqual([]);
    const segments = tokenizeDelimitedSource('\uFEFFa,b\r\nc,d\re', ',');
    expect(segments.map((segment) => segment.text).join('')).toBe('\uFEFFa,b\r\nc,d\re');
    expect(segments[0]).toMatchObject({ kind: 'syntax', text: '\uFEFF' });
    expect(segments.some((segment) => segment.text === '\r\n')).toBe(true);
  });

  it('parses fence info options', () => {
    expect(parseDelimitedFenceInfo('')).toEqual({ delimiter: undefined, headerMode: 'auto' });
    expect(parseDelimitedFenceInfo('tsv header')).toEqual({ delimiter: '\t', headerMode: 'header' });
    expect(parseDelimitedFenceInfo('csv no-header delimiter=;')).toEqual({ delimiter: ';', headerMode: 'noheader' });
    expect(parseDelimitedFenceInfo('csv noheader delimiter=pipe').delimiter).toBe('|');
    expect(parseDelimitedFenceInfo('tsv delimiter=xyz').delimiter).toBe('\t');
    expect(parseDelimitedFenceInfo('csv delimiter=# other').delimiter).toBeUndefined();
  });

  it('handles escaped quotes, CR newlines, trailing newlines and malformed quotes', () => {
    const parsed = parseDelimitedText('name,quote\r\n"Ann","say ""hi"""\r\n"multi\r\nline",x\n', { headerMode: 'header' });
    expect(parsed.rows).toEqual([['Ann', 'say "hi"'], ['multi\nline', 'x']]);
    expect(parseDelimitedText('a,"open\n').warnings).toContain('malformedQuote');
    const uneven = parseDelimitedText('a,b\nc', { headerMode: 'noheader' });
    expect(uneven.warnings).toContain('unevenRows');
    expect(uneven.headers).toEqual(['A', 'B']);
    expect(uneven.rows[1]).toEqual(['c', '']);
    expect(parseDelimitedText('', {}).headers).toEqual([]);
  });

  it('detects delimiters by consistency and width', () => {
    expect(detectDelimiter('a;b;c\nd;e;f')).toBe(';');
    expect(detectDelimiter('a|b\nc|d')).toBe('|');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(detectDelimiter('plain')).toBe(',');
  });

  it('names columns like spreadsheets', () => {
    expect(excelColumnName(0)).toBe('A');
    expect(excelColumnName(26)).toBe('AA');
    expect(excelColumnName(-1)).toBe('');
    expect(excelColumnName(1.5)).toBe('');
  });

  it('infers headers from labels and type changes', () => {
    expect(inferHeader([])).toBe(false);
    expect(inferHeader([['name', 'age'], ['Ann', '3'], ['Bob', '4']])).toBe(true);
    expect(inferHeader([['', 'x'], ['1', '2']])).toBe(false);
    expect(inferHeader([['a', 'a'], ['1', '2']])).toBe(false);
    expect(inferHeader([['1', '2'], ['3', '4']])).toBe(false);
    expect(inferHeader([['enabled', 'when'], ['true', ''], ['no', '']])).toBeTypeOf('boolean');
    const parsed = parseDelimitedText('Name,,Name\nA,B,C', { headerMode: 'header' });
    expect(parsed.headers.length).toBe(3);
    expect(parsed.headers[1]).toBe('B');
  });
});
