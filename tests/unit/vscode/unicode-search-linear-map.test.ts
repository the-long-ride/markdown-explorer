import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
import * as vscodeSearch from '../../../vscode/src/core/unicodeSearch';
import * as uiSearch from '../../../ui/src/utils/unicodeSearch';

const require = createRequire(import.meta.url);
const electronSearch = require('../../../electron/search/unicode-search.js');

type IndexOf = (text: string, needle: string, fromIndex?: number) => { index: number; matchLength: number } | null;

const implementations: Array<[string, IndexOf]> = [
  ['vscode', vscodeSearch.unicodeIndexOf],
  ['ui', uiSearch.unicodeIndexOf],
  ['electron', (text, needle) => electronSearch.prepareHaystack(text).indexOf(needle, 0)],
];

// Reference for the original per-character incremental map (quadratic), used to
// prove the linear implementation keeps identical original-string coordinates.
function normalize(text: string): string {
  return text.normalize('NFC').toLocaleUpperCase().toLocaleLowerCase().replace(/̇/g, '');
}

function referenceIndexOf(text: string, needle: string): { index: number; matchLength: number } | null {
  const normalizedText = normalize(text);
  const normNeedle = normalize(needle);
  const normIdx = normalizedText.indexOf(normNeedle);
  if (normIdx === -1) return null;
  if (normalizedText.length === text.length) return { index: normIdx, matchLength: normNeedle.length };
  const toOriginal = new Uint32Array(normalizedText.length);
  let accumulated = '';
  let last = 0;
  for (let pos = 0; pos < text.length; pos++) {
    const char = String.fromCodePoint(text.codePointAt(pos)!);
    accumulated += char;
    const current = normalize(accumulated).length;
    for (let k = last; k < current && k < normalizedText.length; k++) toOriginal[k] = pos;
    last = current;
    if (char.length > 1) pos++;
  }
  const origIdx = toOriginal[normIdx];
  const normEnd = normIdx + normNeedle.length;
  let origEnd = text.length;
  if (normEnd < normalizedText.length) {
    let k = normEnd;
    while (k < normalizedText.length && toOriginal[k] === toOriginal[normEnd - 1]) k++;
    origEnd = k < normalizedText.length ? toOriginal[k] : text.length;
  }
  return { index: origIdx, matchLength: origEnd - origIdx };
}

const samples: Array<[string, string]> = [
  ['Café au lait, café noir', 'café noir'],
  ['Tiếng Việt là ngôn ngữ', 'việt'],
  ['Die Straße ist lang, STRASSE', 'strasse ist'],
  ['İstanbul ve İzmir', 'izmir'],
  ['x́̂ combining on x, then é', 'é'],
  ['emoji 😀 then Straße', 'straße'],
  ['각 hangul jamo 가', 'jamo'],
];

describe.each(implementations)('%s unicodeIndexOf coordinate mapping', (_name, indexOf) => {
  test.each(samples)('matches the reference mapping for %j', (text, needle) => {
    expect(indexOf(text, needle)).toEqual(referenceIndexOf(text, needle));
  });

  test('stays fast on large decomposed (macOS NFD) documents', () => {
    const text = `${'Tiếng Việt café '.repeat(8000)}needle`;
    const startedAt = performance.now();
    const match = indexOf(text, 'needle');
    const elapsed = performance.now() - startedAt;
    expect(match?.index).toBe(text.length - 6);
    expect(elapsed).toBeLessThan(1000);
  });
});
