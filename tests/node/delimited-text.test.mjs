import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDelimiter,
  excelColumnName,
  parseDelimitedFenceInfo,
  parseDelimitedText,
  tokenizeDelimitedSource,
} from '../../ui/src/markdown/delimitedText.ts';

test('detects standard comma, tab, semicolon, and pipe delimiters', () => {
  assert.equal(detectDelimiter('name,count\na,1\nb,2'), ',');
  assert.equal(detectDelimiter('name\tcount\na\t1\nb\t2'), '\t');
  assert.equal(detectDelimiter('name;count\na;1\nb;2'), ';');
  assert.equal(detectDelimiter('name|count\na|1\nb|2'), '|');
});

test('parses quoted separators, escaped quotes, multiline values, BOM, and CRLF', () => {
  const source = '\uFEFFname,notes,count\r\n"Desktop","first, second",10\r\n"Web","line 1\r\nline 2 and ""quoted""",20\r\n';
  const preview = parseDelimitedText(source, { headerMode: 'auto' });
  assert.deepEqual(preview.headers, ['name', 'notes', 'count']);
  assert.deepEqual(preview.rows, [
    ['Desktop', 'first, second', '10'],
    ['Web', 'line 1\nline 2 and "quoted"', '20'],
  ]);
  assert.deepEqual(preview.warnings, []);
});

test('uses automatic header and delimiter defaults when options are omitted', () => {
  const preview = parseDelimitedText('name;count\nDesktop;10\nWebsite;20');
  assert.equal(preview.delimiter, ';');
  assert.equal(preview.hasHeader, true);
  assert.deepEqual(preview.headers, ['name', 'count']);
});

test('keeps automatic header detection when only a delimiter is supplied', () => {
  const preview = parseDelimitedText('name\tcount\nDesktop\t10\nWebsite\t20', { delimiter: '\t' });
  assert.equal(preview.hasHeader, true);
  assert.deepEqual(preview.headers, ['name', 'count']);
});

test('supports explicit delimiter and header metadata overrides', () => {
  assert.deepEqual(parseDelimitedFenceInfo('csv noheader delimiter=tab'), {
    delimiter: '\t',
    headerMode: 'noheader',
  });
  assert.deepEqual(parseDelimitedFenceInfo('tsv header'), {
    delimiter: '\t',
    headerMode: 'header',
  });
});

test('detects common all-text header labels across non-comma formats', () => {
  const pipe = parseDelimitedText('name|note\nDesktop|Stable build\nWebsite|Hosted build', { headerMode: 'auto' });
  assert.equal(pipe.delimiter, '|');
  assert.equal(pipe.hasHeader, true);
  assert.deepEqual(pipe.headers, ['name', 'note']);

  const tab = parseDelimitedText('label\tdescription\nDesktop\tNative app\nWebsite\tHosted app', { headerMode: 'auto' });
  assert.equal(tab.delimiter, '\t');
  assert.equal(tab.hasHeader, true);
  assert.deepEqual(tab.headers, ['label', 'description']);
});

test('automatically detects headers and generates Excel-style headers when absent', () => {
  const withHeader = parseDelimitedText('variant,downloads\nDesktop,100\nWeb,200', { headerMode: 'auto' });
  assert.equal(withHeader.hasHeader, true);
  assert.deepEqual(withHeader.headers, ['variant', 'downloads']);

  const withoutHeader = parseDelimitedText('Desktop\t100\ttrue\nWeb\t200\tfalse', { delimiter: '\t', headerMode: 'auto' });
  assert.equal(withoutHeader.hasHeader, false);
  assert.deepEqual(withoutHeader.headers, ['A', 'B', 'C']);
  assert.equal(excelColumnName(25), 'Z');
  assert.equal(excelColumnName(26), 'AA');
  assert.equal(excelColumnName(51), 'AZ');
  assert.equal(excelColumnName(52), 'BA');
});

test('preserves source usability by returning warnings for malformed or uneven data', () => {
  const preview = parseDelimitedText('name,count\n"broken,1\nshort', { headerMode: 'header' });
  assert.ok(preview.warnings.includes('malformedQuote'));
  assert.ok(preview.warnings.includes('unevenRows'));
});

test('detects a common text header in a single-column file', () => {
  const preview = parseDelimitedText('name\nDesktop\nWebsite', { headerMode: 'auto' });
  assert.equal(preview.hasHeader, true);
  assert.deepEqual(preview.headers, ['name']);
  assert.deepEqual(preview.rows, [['Desktop'], ['Website']]);
});


test('tokenizes delimited source by field while preserving quotes, delimiters, and multiline values', () => {
  const source = 'name,notes,count\nDesktop,"first, second",10\nWeb,"line 1\nline 2 and ""quoted""",20';
  const segments = tokenizeDelimitedSource(source, ',');
  assert.equal(segments.map((segment) => segment.text).join(''), source);

  const colored = segments.filter((segment) => segment.kind === 'field');
  assert.ok(colored.some((segment) => segment.columnIndex === 0 && segment.text.includes('Desktop')));
  assert.ok(colored.some((segment) => segment.columnIndex === 1 && segment.text.includes('first, second')));
  assert.ok(colored.some((segment) => segment.columnIndex === 2 && segment.text.includes('10')));

  const syntax = segments.filter((segment) => segment.kind === 'syntax').map((segment) => segment.text).join('');
  assert.ok(syntax.includes(','));
  assert.ok(syntax.includes('""'));
});

test('restarts source column indexes after row breaks but not inside quoted multiline values', () => {
  const segments = tokenizeDelimitedSource('A\t"B\ncontinued"\tC\nD\tE\tF', '\t');
  const continued = segments.find((segment) => segment.kind === 'field' && segment.text.includes('continued'));
  const rowTwo = segments.find((segment) => segment.kind === 'field' && segment.text.includes('D'));
  assert.equal(continued?.columnIndex, 1);
  assert.equal(rowTwo?.columnIndex, 0);
});
