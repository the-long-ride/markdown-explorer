import { describe, expect, it } from 'vitest';
import {
  detectDelimiter,
  excelColumnName,
  inferHeader,
  parseDelimitedFenceInfo,
  parseDelimitedText,
  tokenizeDelimitedSource,
} from '../../../vscode/src/markdown/delimitedText';

describe('vscode delimitedText', () => {
  it('preserves source syntax around escaped quotes and quoted multiline fields', () => {
    const source = '\uFEFF"first","line\r\nwith ""quote"""\r\nnext,value';
    const parts = tokenizeDelimitedSource(source, ',');
    expect(parts.map(part => part.text).join('')).toBe(source);
    expect(parts.filter(part => part.kind === 'field').map(part => [part.columnIndex, part.text])).toEqual([
      [0, 'first'], [1, 'line'], [1, 'with '], [1, 'quote'], [0, 'next'], [1, 'value'],
    ]);
    expect(parseDelimitedText(source, { headerMode: 'noheader' }).rows).toEqual([
      ['first', 'line\nwith "quote"'], ['next', 'value'],
    ]);
  });

  it('preserves literal quotes, trailing fields and lone CRs inside quoted values', () => {
    expect(parseDelimitedText('ordinary"quote,"first\rsecond"\r\nnext,\r\n\r\n', {
      delimiter: ',', headerMode: 'noheader',
    })).toMatchObject({ rows: [['ordinary"quote', 'first\nsecond'], ['next', '']], warnings: [] });
    expect(parseDelimitedText('one,', { delimiter: ',', headerMode: 'noheader' }).rows).toEqual([['one', '']]);
  });

  it('recognizes literal delimiter options and leaves the last valid choice intact', () => {
    expect(parseDelimitedFenceInfo('')).toEqual({ delimiter: undefined, headerMode: 'auto' });
    expect(parseDelimitedFenceInfo('TSV no-header delimiter=; delimiter=invalid delimiter=.'))
      .toEqual({ delimiter: ';', headerMode: 'noheader' });
    expect(excelColumnName(1.5)).toBe('');
    expect(excelColumnName(-1)).toBe('');
    expect(parseDelimitedText('', { headerMode: 'header' })).toMatchObject({ headers: [], rows: [], hasHeader: true });
  });

  it.each([
    [[[], []], false],
    [[['template', ''], ['a', 'b']], false],
    [[['code', 'cOdE'], ['a', 'b']], false],
    [[['When', 'Enabled'], ['1/2/2026', 'false'], ['2026-01-03', 'yes']], true],
    [[['Name', 'Item code'], ['First', 'X'], ['Second', 'Y']], true],
    [[['alpha team', 'beta_group'], ['A', 'B']], true],
    [[['§', '?'], ['A', 'B']], false],
    [[['7', 'alpha'], ['letters', ''], ['words', '']], false],
    [[['title'], ['Visible text']], true],
    [[['other'], ['Visible text']], false],
    [[['name'], ['Alpha', 'neutral'], ['123', '']], false],
    [[['12', '9'], ['4', ''], ['text', '6'], ['8', '7']], false],
  ])('infers a heading only when the leading row is sufficiently distinct: %j', (rows, expected) => {
    expect(inferHeader(rows)).toBe(expected);
  });

  describe('excelColumnName', () => {
    it('generates single and multi-letter column names', () => {
      expect(excelColumnName(0)).toBe('A');
      expect(excelColumnName(25)).toBe('Z');
      expect(excelColumnName(26)).toBe('AA');
      expect(excelColumnName(27)).toBe('AB');
      expect(excelColumnName(51)).toBe('AZ');
      expect(excelColumnName(52)).toBe('BA');
      expect(excelColumnName(701)).toBe('ZZ');
      expect(excelColumnName(702)).toBe('AAA');
    });
  });

  describe('detectDelimiter', () => {
    it('detects standard delimiters', () => {
      expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
      expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
      expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
      expect(detectDelimiter('a|b|c\n1|2|3')).toBe('|');
    });

    it('ignores delimiters inside quotes when scoring', () => {
      const source = '"col1,part2";col2;col3\n1;2;3';
      expect(detectDelimiter(source)).toBe(';');
    });

    it('defaults to comma when no delimiters or ambiguous', () => {
      expect(detectDelimiter('simple single line text')).toBe(',');
    });
  });

  describe('parseDelimitedFenceInfo', () => {
    it('parses format and options from info string', () => {
      expect(parseDelimitedFenceInfo('csv noheader delimiter=tab')).toEqual({
        delimiter: '\t',
        headerMode: 'noheader',
      });
      expect(parseDelimitedFenceInfo('tsv header')).toEqual({
        delimiter: '\t',
        headerMode: 'header',
      });
      expect(parseDelimitedFenceInfo('csv delimiter=semicolon header')).toEqual({
        delimiter: ';',
        headerMode: 'header',
      });
      expect(parseDelimitedFenceInfo('csv delimiter=pipe')).toEqual({
        delimiter: '|',
        headerMode: 'auto',
      });
      expect(parseDelimitedFenceInfo('csv delimiter=comma')).toEqual({
        delimiter: ',',
        headerMode: 'auto',
      });
    });

    it('ignores unknown tokens safely', () => {
      expect(parseDelimitedFenceInfo('csv unknown-token extra=value')).toEqual({
        delimiter: undefined,
        headerMode: 'auto',
      });
    });
  });

  describe('tokenizeDelimitedSource', () => {
    it('tokenizes fields and syntax delimiters', () => {
      const segments = tokenizeDelimitedSource('a,b\n1,2', ',');
      expect(segments).toEqual([
        { kind: 'field', text: 'a', columnIndex: 0 },
        { kind: 'syntax', text: ',', columnIndex: 0 },
        { kind: 'field', text: 'b', columnIndex: 1 },
        { kind: 'syntax', text: '\n', columnIndex: 1 },
        { kind: 'field', text: '1', columnIndex: 0 },
        { kind: 'syntax', text: ',', columnIndex: 0 },
        { kind: 'field', text: '2', columnIndex: 1 },
      ]);
    });

    it('handles quoted values, escaped quotes, and newlines', () => {
      const source = '"one, two","line1\nline2","has ""quotes"""';
      const segments = tokenizeDelimitedSource(source, ',');
      const fields = segments.filter(s => s.kind === 'field');
      expect(fields[0].text).toBe('one, two');
      expect(fields[1].text).toBe('line1');
      expect(fields[2].text).toBe('line2');
      expect(fields[3].text).toBe('has ');
      expect(fields[4].text).toBe('quotes');
      const syntax = segments.filter(s => s.kind === 'syntax');
      expect(syntax.some(s => s.text === '""')).toBe(true);
      expect(syntax.some(s => s.text === '\n')).toBe(true);
    });

    it('handles unclosed quotes without crashing', () => {
      const segments = tokenizeDelimitedSource('a,"unclosed text', ',');
      expect(segments.some(s => s.text.includes('unclosed'))).toBe(true);
    });
  });

  describe('parseDelimitedText', () => {
    it('parses valid CSV with BOM, CRLF, and quotes', () => {
      const source = '\uFEFFname,count\r\n"Item 1",10\r\n"Item 2",20\r\n';
      const result = parseDelimitedText(source);
      expect(result.delimiter).toBe(',');
      expect(result.hasHeader).toBe(true);
      expect(result.headers).toEqual(['name', 'count']);
      expect(result.rows).toEqual([
        ['Item 1', '10'],
        ['Item 2', '20'],
      ]);
      expect(result.warnings).toEqual([]);
    });

    it('handles duplicate headers and blank headers with auto normalization', () => {
      const source = 'name,name,,\nval1,val2,val3,val4';
      const result = parseDelimitedText(source, { headerMode: 'header' });
      expect(result.headers).toEqual(['name', 'name 2', 'C', 'D']);
    });

    it('detects uneven rows and malformed quotes as warnings', () => {
      const source = 'a,b,c\n1,2\n3,"broken quote,4,5,6';
      const result = parseDelimitedText(source, { headerMode: 'noheader' });
      expect(result.warnings).toContain('unevenRows');
      expect(result.warnings).toContain('malformedQuote');
      expect(result.rows[0].length).toBe(result.headers.length);
    });

    it('handles single column tables and auto header inference', () => {
      const withHeader = parseDelimitedText('Title\nFirst line\nSecond line', { headerMode: 'auto' });
      expect(withHeader.hasHeader).toBe(true);
      expect(withHeader.headers).toEqual(['Title']);
      expect(withHeader.rows).toEqual([['First line'], ['Second line']]);

      const numbersOnly = parseDelimitedText('100\n200\n300', { headerMode: 'auto' });
      expect(numbersOnly.hasHeader).toBe(false);
      expect(numbersOnly.headers).toEqual(['A']);
    });

    it('handles empty input gracefully', () => {
      const empty = parseDelimitedText('');
      expect(empty.rows).toEqual([]);
      expect(empty.headers).toEqual([]);
      expect(empty.warnings).toEqual([]);
    });

    it('respects noheader override', () => {
      const result = parseDelimitedText('name,score\nAlice,95', { headerMode: 'noheader' });
      expect(result.hasHeader).toBe(false);
      expect(result.headers).toEqual(['A', 'B']);
      expect(result.rows).toEqual([
        ['name', 'score'],
        ['Alice', '95'],
      ]);
    });
  });
});
