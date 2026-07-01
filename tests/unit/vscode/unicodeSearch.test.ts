import { describe, expect, test } from 'vitest';
import {
  normalizeForSearch,
  unicodeIndexOf,
  unicodeFindAll,
  prepareHaystack,
} from '../../../vscode/src/core/unicodeSearch';

describe('normalizeForSearch', () => {
  test('lowercases NFC-normalized text', () => {
    expect(normalizeForSearch('HELLO')).toBe('hello');
    expect(normalizeForSearch('Caf\u00E9')).toBe('caf\u00E9');
  });

  test('handles composed vs decomposed', () => {
    const composed = 'Caf\u00E9';
    const decomposed = 'Cafe\u0301';
    expect(normalizeForSearch(composed)).toBe(normalizeForSearch(decomposed));
  });

  test('strips combining dot above from Turkish İ', () => {
    const turkishI = '\u0130stanbul';
    const normalized = normalizeForSearch(turkishI);
    expect(normalized).toBe('istanbul');
  });

  test('handles empty string', () => {
    expect(normalizeForSearch('')).toBe('');
  });

  test('handles German ß', () => {
    const sharpS = 'Stra\u00dfe';
    const normalized = normalizeForSearch(sharpS);
    expect(normalized).toContain('stra');
  });
});

describe('unicodeIndexOf', () => {
  test('finds needle in text', () => {
    const result = unicodeIndexOf('Hello World', 'world');
    expect(result!.index).toBe(6);
    expect(result!.matchLength).toBe(5);
  });

  test('returns null on empty needle', () => {
    expect(unicodeIndexOf('Hello', '')).toBeNull();
  });

  test('returns null on empty normalized needle', () => {
    expect(unicodeIndexOf('Hello', ' ')).toBeNull();
  });

  test('returns null when needle not found', () => {
    expect(unicodeIndexOf('Hello World', 'xyz')).toBeNull();
  });

  test('respects fromIndex', () => {
    const result = unicodeIndexOf('Hello Hello', 'hello', 3);
    expect(result!.index).toBe(6);
  });

  test('fromIndex past end returns null', () => {
    expect(unicodeIndexOf('Hello', 'hello', 10)).toBeNull();
  });

  test('handles Turkish İ search', () => {
    const text = '\u0130stanbul is a city';
    const result = unicodeIndexOf(text, 'istanbul');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
  });

  test('handles composed/decomposed match', () => {
    const text = 'Caf\u00E9 au lait';
    const result = unicodeIndexOf(text, 'cafe\u0301');
    expect(result).not.toBeNull();
  });

  test('works with fromIndex when norm map exists', () => {
    const text = '\u0130stanbul \u0130stanbul';
    const result = unicodeIndexOf(text, 'istanbul', 5);
    expect(result).not.toBeNull();
    expect(result!.index).toBeGreaterThan(0);
  });

  test('returns null for empty needle even with Turkish text', () => {
    expect(unicodeIndexOf('\u0130stanbul', '')).toBeNull();
  });
});

describe('unicodeFindAll', () => {
  test('finds all non-overlapping matches', () => {
    const results = unicodeFindAll('hello hello hello', 'hello');
    expect(results.length).toBe(3);
    expect(results[0].index).toBe(0);
    expect(results[1].index).toBe(6);
    expect(results[2].index).toBe(12);
  });

  test('respects maxResults', () => {
    const results = unicodeFindAll('hello hello hello', 'hello', 2);
    expect(results.length).toBe(2);
  });

  test('returns empty array on empty needle', () => {
    expect(unicodeFindAll('hello', '')).toEqual([]);
  });

  test('returns empty array on empty text', () => {
    expect(unicodeFindAll('', 'hello')).toEqual([]);
  });

  test('returns empty array when no match', () => {
    expect(unicodeFindAll('hello', 'xyz')).toEqual([]);
  });

  test('returns empty array on empty normalized needle', () => {
    expect(unicodeFindAll('hello', '   ')).toEqual([]);
  });

  test('finds Turkish matches', () => {
    const text = '\u0130stanbul ve \u0130stanbul';
    const results = unicodeFindAll(text, 'istanbul');
    expect(results.length).toBe(2);
  });
});

describe('prepareHaystack', () => {
  test('returns indexOf that works like unicodeIndexOf', () => {
    const haystack = prepareHaystack('Hello World');
    const result = haystack.indexOf('world');
    expect(result!.index).toBe(6);
    expect(result!.matchLength).toBe(5);
  });

  test('indexOf returns null on empty needle', () => {
    const haystack = prepareHaystack('Hello');
    expect(haystack.indexOf('')).toBeNull();
  });

  test('indexOf returns null on whitespace-only needle', () => {
    const haystack = prepareHaystack('Hello');
    expect(haystack.indexOf('  ')).toBeNull();
  });

  test('indexOf returns null when not found', () => {
    const haystack = prepareHaystack('Hello');
    expect(haystack.indexOf('xyz')).toBeNull();
  });

  test('indexOfNormalized works with pre-normalized needle', () => {
    const haystack = prepareHaystack('Hello World');
    const result = haystack.indexOfNormalized(normalizeForSearch('world'));
    expect(result!.match.index).toBe(6);
    expect(result!.nextNormIndex).toBe(11);
  });

test('indexOfNormalized with empty needle returns match at index 0', () => {
      const haystack = prepareHaystack('Hello');
      const result = haystack.indexOfNormalized('');
      expect(result).not.toBeNull();
      expect(result!.match.index).toBe(0);
    });

  test('indexOfNormalized returns null when not found', () => {
    const haystack = prepareHaystack('Hello');
    expect(haystack.indexOfNormalized('xyz')).toBeNull();
  });

  test('indexOfNormalized returns null for whitespace-only norm needle', () => {
    const haystack = prepareHaystack('Hello');
    expect(haystack.indexOfNormalized('  ')).toBeNull();
  });

  test('normalizedText is accessible', () => {
    const haystack = prepareHaystack('HELLO');
    expect(haystack.normalizedText).toBe('hello');
  });
});

describe('buildNormMap with length-changing normalization', () => {
  test('creates toOriginal map when fi ligature expands', () => {
    const text = '\ufb01le';
    const haystack = prepareHaystack(text);
    expect(haystack.normalizedText).toBe('file');
    expect(haystack.normalizedText.length).toBeGreaterThan(text.length);
  });

  test('mapSpan with toOriginal maps normalized index back to original', () => {
    const result = unicodeIndexOf('\ufb01le', 'fi');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
    expect(result!.matchLength).toBe(1);
  });

  test('mapSpan with normEnd >= normalizedText.length returns original.length', () => {
    const text = '\ufb01le';
    const result = unicodeIndexOf(text, 'file');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
    expect(result!.matchLength).toBe(text.length);
  });

  test('mapSpan else branch where toOriginal[k] === toOriginal[normEnd-1]', () => {
    const text = 'fix\ufb01le';
    const result = unicodeIndexOf(text, 'i');
    expect(result).not.toBeNull();
  });

  test('mapSpan else branch where k >= normalizedText.length sets origEnd to original.length', () => {
    const text = '\ufb01';
    const result = unicodeIndexOf(text, 'fi');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
    expect(result!.matchLength).toBe(1);
  });
});

describe('unicodeIndexOf with fromIndex and length-changing normalization', () => {
  test('fromIndex > 0 with toOriginal map finds second match', () => {
    const text = '\ufb01le \ufb01nd';
    const result = unicodeIndexOf(text, 'fi', 2);
    expect(result).not.toBeNull();
    expect(result!.index).toBeGreaterThan(0);
  });

  test('fromIndex past all matches with toOriginal map returns null', () => {
    const text = '\ufb01le';
    const result = unicodeIndexOf(text, 'fi', 50);
    expect(result).toBeNull();
  });

  test('fromIndex at end of text with toOriginal map sets normFromIndex to normalizedText.length', () => {
    const text = '\ufb01';
    const result = unicodeIndexOf(text, 'fi', 2);
    expect(result).toBeNull();
  });

  test('fromIndex = 1 with NFD accent text', () => {
    const text = 'he\u0301llo he\u0301y';
    const result = unicodeIndexOf(text, 'e\u0301', 8);
    expect(result).not.toBeNull();
    expect(result!.index).toBeGreaterThan(0);
  });

  test('fromIndex 0 with fi ligature finds at start', () => {
    const result = unicodeIndexOf('\ufb01le', 'fi', 0);
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
  });
});

describe('unicodeFindAll with length-changing normalization', () => {
  test('finds all matches with fi ligature', () => {
    const text = '\ufb01le \ufb01nd';
    const results = unicodeFindAll(text, 'fi');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].index).toBe(0);
  });

  test('returns correct matchLength with length-changing normalization', () => {
    const text = '\ufb01le';
    const results = unicodeFindAll(text, 'file');
    expect(results.length).toBe(1);
    expect(results[0].matchLength).toBe(text.length);
  });

  test('finds all with NFD accent text', () => {
    const text = 'cafe\u0301 cafe\u0301';
    const results = unicodeFindAll(text, 'café');
    expect(results.length).toBe(2);
  });

  test('maxResults limits with length-changing normalization', () => {
    const text = '\ufb01le \ufb01nd \ufb01t';
    const results = unicodeFindAll(text, 'fi', 1);
    expect(results.length).toBe(1);
  });
});

describe('prepareHaystack with length-changing normalization', () => {
  test('indexOf with fi ligature text', () => {
    const haystack = prepareHaystack('\ufb01le is great');
    const result = haystack.indexOf('fi');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
  });

  test('indexOfNormalized with fi ligature text', () => {
    const haystack = prepareHaystack('\ufb01le');
    const result = haystack.indexOfNormalized(normalizeForSearch('\ufb01le'));
    expect(result).not.toBeNull();
    expect(result!.match.index).toBe(0);
  });

  test('indexOf with fromIndex past end in fi ligature text', () => {
    const haystack = prepareHaystack('\ufb01le');
    const result = haystack.indexOf('fi', 100);
    expect(result).toBeNull();
  });

  test('indexOfNormalized with fromIndex past match', () => {
    const haystack = prepareHaystack('\ufb01le');
    const result = haystack.indexOfNormalized(normalizeForSearch('\ufb01le'), 100);
    expect(result).toBeNull();
  });

  test('indexOfNormalized iterates through multiple matches with fi ligature', () => {
    const haystack = prepareHaystack('\ufb01le \ufb01nd');
    const norm = normalizeForSearch('fi');
    const first = haystack.indexOfNormalized(norm, 0);
    expect(first).not.toBeNull();
    const second = haystack.indexOfNormalized(norm, first!.nextNormIndex);
    expect(second).not.toBeNull();
    expect(second!.match.index).toBeGreaterThan(0);
  });

  test('indexOf with NFD accent text', () => {
    const haystack = prepareHaystack('cafe\u0301');
    const result = haystack.indexOf('café');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
  });
});

describe('mapSpan while-advance-then-hit-end branch', () => {
  test('search for single char inside expanded ligature at text end', () => {
    const text = 'a\ufb01';
    const result = unicodeIndexOf(text, 'f');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(1);
  });

  test('search for substring spanning expanded ligature boundary near end', () => {
    const text = 'x\ufb01';
    const result = unicodeIndexOf(text, 'fi');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(1);
    expect(result!.matchLength).toBe(1);
  });
});

describe('buildNormMap with surrogate pair and length-changing normalization', () => {
  test('handles emoji + fi ligature with toOriginal map', () => {
    const text = '\u{1F600}\ufb01';
    const result = unicodeIndexOf(text, 'fi');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(2);
    expect(result!.matchLength).toBe(1);
  });

  test('search for full content with emoji and ligature', () => {
    const text = '\u{1F600}\ufb01';
    const result = unicodeIndexOf(text, '\u{1F600}fi');
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
  });
});