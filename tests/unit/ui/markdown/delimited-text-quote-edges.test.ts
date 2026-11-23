import { describe, expect, it } from 'vitest';
import { inferHeader, parseDelimitedText, tokenizeDelimitedSource } from '../../../../ui/src/markdown/delimitedText';

describe('delimited text quote and header edges', () => {
  it('handles CRLF inside quotes, trailing blank rows and empty tokens', () => {
    const preview = parseDelimitedText('a,b\r\n"x\r\ny",2\r\n,\r\n\r\n', { delimiter: ',', headerMode: 'header' }) as any;
    expect(preview.rows[0][0]).toBe('x\ny');
    expect(preview.rows).toHaveLength(1);
    expect(tokenizeDelimitedSource('', ',')).toEqual([]);
  });

  it('infers headers from missing cells and blank header labels', () => {
    expect(inferHeader([])).toBe(false);
    expect(inferHeader([['name', 'age'], ['ann'], ['bob', '3']])).toBe(true);
    const preview = parseDelimitedText('name,\nann,1\nbob,2', { delimiter: ',', headerMode: 'header' }) as any;
    expect(preview.headers[1]).toBe('B');
    const noHeader = parseDelimitedText('', { headerMode: 'header' }) as any;
    expect(noHeader.rows).toEqual([]);
  });
});
