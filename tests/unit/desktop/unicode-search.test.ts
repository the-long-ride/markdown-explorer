import { describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeForSearch, prepareHaystack, buildNormMap, identityMapSpan, mappingMapSpan, computeOrigEnd, haystackIndexOf, haystackIndexOfNormalized } = require('../../../desktop/unicode-search.js');

describe('normalizeForSearch', () => {
  test('NFC-normalizes, uppercases, lowercases, and strips combining dot above', () => {
    expect(normalizeForSearch('\u0130stanbul')).toBe('istanbul');
  });

  test('German sharp s normalizes to ss', () => {
    const result = normalizeForSearch('Stra\u00DFe');
    expect(result).toContain('strasse');
  });

  test('NFC composes decomposed characters', () => {
    expect(normalizeForSearch('cafe\u0301')).toContain('caf\u00E9');
  });

  test('ASCII text passes through unchanged', () => {
    expect(normalizeForSearch('Hello World')).toBe('hello world');
  });

  test('empty string remains empty', () => {
    expect(normalizeForSearch('')).toBe('');
  });
});

describe('buildNormMap', () => {
  test('returns identity map when normalized length equals original length', () => {
    const map = buildNormMap('hello');
    expect(map.normalizedText).toBe('hello');
    expect(map.toOriginal).toBeNull();
    const span = map.mapSpan(0, 5);
    expect(span.origIdx).toBe(0);
    expect(span.origLen).toBe(5);
  });

  test('creates position map for text that changes length after normalization', () => {
    const map = buildNormMap('Stra\u00DFe');
    expect(map.normalizedText).toBe('strasse');
    expect(map.toOriginal).not.toBeNull();
  });

  test('mapSpan maps normIdx to correct original position', () => {
    const map = buildNormMap('Stra\u00DFe');
    expect(map.toOriginal).not.toBeNull();
    const span = map.mapSpan(3, 2);
    expect(span.origIdx).toBe(3);
    expect(span.origLen).toBe(2);
  });

  test('mapSpan handles span at end of text', () => {
    const map = buildNormMap('Stra\u00DFe');
    const span = map.mapSpan(5, 2);
    expect(span.origIdx).toBeGreaterThanOrEqual(0);
    expect(span.origLen).toBeGreaterThan(0);
  });

  test('mapSpan falls back to normIdx when toOriginal is null', () => {
    const map = buildNormMap('hello');
    const span = map.mapSpan(2, 3);
    expect(span.origIdx).toBe(2);
    expect(span.origLen).toBe(3);
  });

  test('mapSpan when normEnd exceeds normalizedText length uses original.length', () => {
    const map = buildNormMap('Stra\u00DFe');
    const span = map.mapSpan(0, 100);
    expect(span.origLen).toBeGreaterThan(0);
  });

  test('mapSpan skips past equivalent norm positions at normEnd edge', () => {
    const map = buildNormMap('Stra\u00DFe');
    const span = map.mapSpan(3, 1);
    expect(span.origIdx).toBe(3);
  });
});

describe('prepareHaystack', () => {
  test('indexOf returns null for empty needle', () => {
    const haystack = prepareHaystack('hello world');
    expect(haystack.indexOf('')).toBeNull();
  });

  test('indexOf finds match in simple text', () => {
    const haystack = prepareHaystack('hello world');
    const result = haystack.indexOf('world');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(6);
    expect(result!.matchLength).toBe(5);
  });

  test('indexOf returns null when no match', () => {
    const haystack = prepareHaystack('hello world');
    expect(haystack.indexOf('xyz')).toBeNull();
  });

  test('indexOf respects normFromIndex', () => {
    const haystack = prepareHaystack('hello hello');
    const first = haystack.indexOf('hello', 0);
    const second = haystack.indexOf('hello', first!.index + first!.matchLength);
    expect(second).not.toBeNull();
    expect(second!.index).toBeGreaterThan(first!.index);
  });

  test('indexOf handles Turkish dotted I', () => {
    const haystack = prepareHaystack('Welcome to \u0130stanbul');
    const result = haystack.indexOf('istanbul');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(11);
    expect(result!.matchLength).toBe(8);
  });

  test('indexOf handles German sharp S', () => {
    const haystack = prepareHaystack('Die Hauptstra\u00DFe ist lang');
    const result = haystack.indexOf('strasse');
    expect(result).not.toBeNull();
  });

  test('indexOfNormalized returns match and nextNormIndex', () => {
    const haystack = prepareHaystack('hello hello');
    const result = haystack.indexOfNormalized('hello', 0);
    expect(result).not.toBeNull();
    expect(result!.match.index).toBe(0);
    expect(result!.match.matchLength).toBe(5);
    expect(result!.nextNormIndex).toBe(5);
  });

  test('indexOfNormalized returns null when no match', () => {
    const haystack = prepareHaystack('hello world');
    expect(haystack.indexOfNormalized('xyz', 0)).toBeNull();
  });

  test('indexOfNormalized finds subsequent matches', () => {
    const haystack = prepareHaystack('hello hello');
    const first = haystack.indexOfNormalized('hello', 0);
    expect(first).not.toBeNull();
    const second = haystack.indexOfNormalized('hello', first!.nextNormIndex);
    expect(second).not.toBeNull();
    expect(second!.match.index).toBe(6);
  });

  test('handles repeated match of same needle', () => {
    const haystack = prepareHaystack('abc abc abc');
    let normIdx = 0;
    let count = 0;
    while (true) {
      const result = haystack.indexOfNormalized('abc', normIdx);
      if (!result) break;
      count++;
      normIdx = result.nextNormIndex;
    }
    expect(count).toBe(3);
  });

  test('handles NFC/NFD equivalence', () => {
    const haystack = prepareHaystack('caf\u00E9');
    const result = haystack.indexOf('caf\u00E9');
    expect(result).not.toBeNull();

    const haystack2 = prepareHaystack('cafe\u0301');
    const result2 = haystack2.indexOf('caf\u00E9');
    expect(result2).not.toBeNull();
  });

  test('handles empty text', () => {
    const haystack = prepareHaystack('');
    expect(haystack.indexOf('test')).toBeNull();
    expect(haystack.indexOfNormalized('test', 0)).toBeNull();
  });
});

describe('buildNormMap uncovered branches', () => {
  test('surrogate pair (emoji) triggers origCharLen > 1 branch with length-changing normalization', () => {
    const map = buildNormMap('a\uD83D\uDE00b\u00DFc');
    expect(map.toOriginal).not.toBeNull();
    expect(map.toOriginal![1]).toBe(1);
    expect(map.toOriginal![2]).toBe(1);
    expect(map.toOriginal![3]).toBe(3);
    const span = map.mapSpan(1, 2);
    expect(span.origIdx).toBe(1);
    expect(span.origLen).toBe(2);
  });

  test('mapSpan with toOriginal[normIdx] undefined falls back to normIdx', () => {
    const map = buildNormMap('ab\u00DF');
    expect(map.toOriginal).not.toBeNull();
    const span = map.mapSpan(4, 1);
    expect(span.origIdx).toBe(4);
  });

  test('mapSpan while-loop terminates with k < length and different toOriginal (origEnd = toOriginal[k])', () => {
    const map = buildNormMap('x\u00DFyz');
    expect(map.toOriginal).not.toBeNull();
    const span = map.mapSpan(1, 1);
    expect(span.origIdx).toBe(1);
    expect(span.origLen).toBe(1);
  });

  test('mapSpan while-loop skips multiple equivalent positions at normEnd edge', () => {
    const map = buildNormMap('A\u00DF\u00DFb');
    const span = map.mapSpan(1, 2);
    expect(span.origIdx).toBe(1);
    expect(span.origLen).toBe(1);
  });

  test('mapSpan while-loop exits with k >= length so origEnd = original.length', () => {
    const map = buildNormMap('ab\u00DF');
    const span = map.mapSpan(2, 2);
    expect(span.origIdx).toBe(2);
    expect(span.origLen).toBe(1);
  });

  test('non-identity mapSpan closure: line 30 else (normalizedText.length !== original.length)', () => {
    const map = buildNormMap('\u00DF');
    expect(map.toOriginal).not.toBeNull();
    expect(map.normalizedText).toBe('ss');
    const span = map.mapSpan(0, 2);
    expect(span.origIdx).toBe(0);
    expect(span.origLen).toBe(1);
  });

  test('non-identity mapSpan closure: line 68 toOriginal[normIdx] truthy (valid index)', () => {
    const map = buildNormMap('ab\u00DF');
    const span = map.mapSpan(0, 1);
    expect(span.origIdx).toBe(0);
    expect(span.origLen).toBe(1);
  });

  test('non-identity mapSpan closure: line 68 toOriginal[normIdx] undefined (fallback to normIdx)', () => {
    const map = buildNormMap('ab\u00DF');
    const span = map.mapSpan(4, 1);
    expect(span.origIdx).toBe(4);
  });
});

describe('prepareHaystack uncovered branches', () => {
  test('identity mapSpan via prepareHaystack: toOriginal null (!toOriginal false branch)', () => {
    const haystack = prepareHaystack('abc');
    const result = haystack.indexOf('bc');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(1);
    expect(result!.matchLength).toBe(2);
  });

  test('indexOf with non-empty needle (if !normNeedle false branch)', () => {
    const haystack = prepareHaystack('Stra\u00DFe');
    const result = haystack.indexOf('strasse');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
  });

  test('indexOf with match found (if normIdx === -1 false branch)', () => {
    const haystack = prepareHaystack('Stra\u00DFe');
    const result = haystack.indexOf('strasse');
    expect(result).not.toBeNull();
  });

  test('indexOfNormalized with match found (if normIdx === -1 false branch)', () => {
    const haystack = prepareHaystack('Stra\u00DFe');
    const result = haystack.indexOfNormalized('strasse', 0);
    expect(result).not.toBeNull();
    expect(result!.match.index).toBe(0);
    expect(result!.nextNormIndex).toBe(7);
  });

  test('indexOfNormalized with normFromIndex > 0 that finds no match', () => {
    const haystack = prepareHaystack('Stra\u00DFe');
    const result = haystack.indexOfNormalized('strasse', 7);
    expect(result).toBeNull();
  });

  test('indexOfNormalized with normFromIndex past end of text returns null', () => {
    const haystack = prepareHaystack('hello');
    expect(haystack.indexOfNormalized('hello', 100)).toBeNull();
  });

  test('indexOf with text containing ß, skips first match', () => {
    const haystack = prepareHaystack('x\u00DFyzx\u00DFyz');
    const first = haystack.indexOf('ss', 0);
    expect(first).not.toBeNull();
    const second = haystack.indexOf('ss', first!.index + first!.matchLength);
    expect(second).not.toBeNull();
    expect(second!.index).toBeGreaterThan(first!.index);
  });
});

describe('identityMapSpan', () => {
  test('returns identity mapping', () => {
    expect(identityMapSpan(0, 5)).toEqual({ origIdx: 0, origLen: 5 });
    expect(identityMapSpan(3, 2)).toEqual({ origIdx: 3, origLen: 2 });
  });
});

describe('mappingMapSpan', () => {
  test('returns identity when toOriginal is null', () => {
    expect(mappingMapSpan(null, 'abc', 'abc', 1, 2)).toEqual({ origIdx: 1, origLen: 2 });
  });

  test('maps normIdx to origIdx via toOriginal', () => {
    const toOriginal = new Uint32Array([0, 1, 2, 3, 3, 4, 5]);
    const result = mappingMapSpan(toOriginal, 'strasse', 'Stra\u00DFe', 3, 2);
    expect(result.origIdx).toBe(3);
    expect(result.origLen).toBe(1);
  });

  test('uses normEnd >= length to get original.length as origEnd', () => {
    const toOriginal = new Uint32Array([0, 1, 2, 3, 3, 4, 5]);
    const result = mappingMapSpan(toOriginal, 'strasse', 'Straße', 0, 100);
    expect(result.origLen).toBe(6);
  });

  test('while-loop exits at k < length with different toOriginal', () => {
    const toOriginal = new Uint32Array([0, 1, 2, 3, 4]);
    const result = mappingMapSpan(toOriginal, 'abcde', 'abcd\u00DF', 3, 1);
    expect(result.origIdx).toBe(3);
    expect(result.origLen).toBeGreaterThanOrEqual(1);
  });

  test('uses normIdx fallback when toOriginal index is undefined', () => {
    const toOriginal = new Uint32Array(3);
    toOriginal[0] = 0;
    toOriginal[1] = 1;
    const result = mappingMapSpan(toOriginal, 'abc', 'ab\u00DF', 5, 1);
    expect(result.origIdx).toBe(5);
  });
});

describe('haystackIndexOf', () => {
  test('returns null for empty needle', () => {
    const map = buildNormMap('hello');
    expect(haystackIndexOf(map, '', 0)).toBeNull();
  });

  test('finds a match', () => {
    const map = buildNormMap('Stra\u00DFe');
    const result = haystackIndexOf(map, 'strasse', 0);
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
  });

  test('returns null when no match', () => {
    const map = buildNormMap('Stra\u00DFe');
    expect(haystackIndexOf(map, 'xyz', 0)).toBeNull();
  });
});

describe('haystackIndexOfNormalized', () => {
  test('returns null when no match', () => {
    const map = buildNormMap('Stra\u00DFe');
    expect(haystackIndexOfNormalized(map, 'xyz', 0)).toBeNull();
  });

  test('finds match', () => {
    const map = buildNormMap('Stra\u00DFe');
    const result = haystackIndexOfNormalized(map, 'strasse', 0);
    expect(result).not.toBeNull();
    expect(result!.match.index).toBe(0);
  });
});

describe('buildNormMap deeper branch coverage', () => {
  test('mapSpan normEnd < length with while loop finding k where toOriginal differs', () => {
    const map = buildNormMap('a\u00DFb');
    const span = map.mapSpan(1, 2);
    expect(span.origIdx).toBe(1);
    expect(span.origLen).toBe(1);
  });

  test('mapSpan while loop exits because k reaches normalizedText.length', () => {
    const map = buildNormMap('a\u00DF');
    const span = map.mapSpan(1, 2);
    expect(span.origIdx).toBe(1);
    expect(span.origLen).toBe(1);
  });

  test('mapSpan k < normalizedText.length path after while loop (origEnd = toOriginal[k])', () => {
    const map = buildNormMap('a\u00DFb\u00DFc');
    const span = map.mapSpan(1, 2);
    expect(span.origIdx).toBe(1);
    expect(span.origLen).toBe(1);
  });

  test('prepareHaystack indexOf with normalized needle that becomes empty', () => {
    const haystack = prepareHaystack('hello');
    expect(haystack.indexOf('\u0307')).toBeNull();
  });

  test('buildNormMap else branch: normalizedText.length !== original.length', () => {
    const map = buildNormMap('Stra\u00DFe');
    expect(map.normalizedText).toBe('strasse');
    expect(map.toOriginal).not.toBeNull();
  });

  test('mapSpan else: toOriginal is NOT null (enters non-identity branch)', () => {
    const map = buildNormMap('a\u00DFb');
    const span = map.mapSpan(0, 1);
    expect(span.origIdx).toBe(0);
    expect(span.origLen).toBe(1);
  });

  test('mapSpan: toOriginal[normIdx] is 0 (falsy but not nullish - still uses 0)', () => {
    const map = buildNormMap('\u00DFabc');
    expect(map.toOriginal).not.toBeNull();
    const span = map.mapSpan(0, 2);
    expect(span.origIdx).toBe(0);
    expect(span.origLen).toBe(1);
  });

  test('prepareHaystack indexOf with non-empty needle in non-identity map', () => {
    const haystack = prepareHaystack('Stra\u00DFe');
    const result = haystack.indexOf('strasse');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
    expect(result!.matchLength).toBe(6);
  });

  test('prepareHaystack indexOfNormalized else: normIdx !== -1 (match found)', () => {
    const haystack = prepareHaystack('a\u00DFb');
    const result = haystack.indexOfNormalized('ss', 0);
    expect(result).not.toBeNull();
    expect(result!.match.index).toBe(1);
    expect(result!.match.matchLength).toBe(1);
  });

  test('prepareHaystack indexOf else: normIdx !== -1 (match found)', () => {
    const haystack = prepareHaystack('a\u00DFb');
    const result = haystack.indexOf('ss');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(1);
  });
});

describe('computeOrigEnd', () => {
  test('returns original.length when normEnd >= normalizedText.length', () => {
    const map = buildNormMap('Stra\u00DFe');
    expect(map.toOriginal).not.toBeNull();
    const result = computeOrigEnd(map.toOriginal!, 'strasse', 'Stra\u00DFe', 100);
    expect(result).toBe(6);
  });

  test('returns toOriginal[k] when k < length with different toOriginal', () => {
    const map = buildNormMap('\u00DFabc');
    expect(map.toOriginal).not.toBeNull();
    const result = computeOrigEnd(map.toOriginal!, 'ssabc', '\u00DFabc', 2);
    expect(result).toBe(1);
  });

  test('returns original.length when k >= length after while loop', () => {
    const map = buildNormMap('a\u00DF');
    expect(map.toOriginal).not.toBeNull();
    const result = computeOrigEnd(map.toOriginal!, 'ass', 'a\u00DF', 3);
    expect(result).toBe(2);
  });
});
