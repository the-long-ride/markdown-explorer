// =============================================================================
// utils/unicodeSearch.ts — Unicode-safe, multilingual search utilities
// =============================================================================
//
// Provides locale-aware, NFC-normalized search that correctly handles:
// - Turkish İ/ı case folding (İ.toLowerCase() produces 2-char "i̇")
// - German ß/ẞ (uppercase ẞ → lowercase ß)
// - Greek σ/ς final-sigma forms
// - Composed vs decomposed Unicode (é as U+00E9 vs e + U+0301)
// =============================================================================

/**
 * Normalize text for search comparison: NFC normalize then lowercase.
 *
 * We apply NFC first so that composed and decomposed forms match,
 * then lowercase so casing is ignored. The result is suitable for
 * indexOf-style comparisons where both haystack and needle have
 * been processed through this function.
 */
export function normalizeForSearch(text: string): string {
  // We apply NFC first, uppercase, then lowercase, then strip the combining dot above (\u0307)
  // which is produced by `toLocaleLowerCase()` on a Turkish İ to preserve its dotted state
  // in locale-agnostic environments. This ensures 'istanbul' matches 'İstanbul',
  // and 'strasse' matches 'straße'.
  return text.normalize('NFC').toLocaleUpperCase().toLocaleLowerCase().replace(/\u0307/g, '');
}

/**
 * Result of a unicode-safe case-insensitive search.
 *
 * `index` — position in the **original** (un-normalized) string.
 * `matchLength` — number of characters in the **original** string
 *                 that correspond to the matched region. This may
 *                 differ from `needle.length` due to case folding.
 */
export interface UnicodeSearchMatch {
  index: number;
  matchLength: number;
}

/**
 * Build a mapping from positions in the normalized-lower string back
 * to positions in the original string.
 *
 * When `.toLocaleLowerCase()` changes character count (e.g. Turkish İ → i̇,
 * German ẞ → ß), a simple 1:1 index mapping breaks. This function builds
 * a forward map: normalizedPos → originalPos, so we can translate a match
 * found in the normalized string back to the original.
 *
 * For performance, we only build the map when lengths actually differ.
 */
function buildNormMap(original: string): {
  normalizedText: string;
  toOriginal: Uint32Array | null;
  mapSpan: (normIdx: number, normLen: number) => { origIdx: number; origLen: number };
} {
  const normalizedText = normalizeForSearch(original);

  if (normalizedText.length === original.length) {
    return {
      normalizedText,
      toOriginal: null,
      mapSpan(normIdx, normLen) {
        return { origIdx: normIdx, origLen: normLen };
      },
    };
  }

  const toOriginal = new Uint32Array(normalizedText.length);
  let accumulatedOrig = '';
  let lastNormLen = 0;

  for (let origPos = 0; origPos < original.length; origPos++) {
    const codePoint = original.codePointAt(origPos)!;
    const origChar = String.fromCodePoint(codePoint);
    const origCharLen = origChar.length;
    
    accumulatedOrig += origChar;
    const currentNormLen = normalizeForSearch(accumulatedOrig).length;

    for (let k = lastNormLen; k < currentNormLen && k < normalizedText.length; k++) {
      toOriginal[k] = origPos;
    }
    
    lastNormLen = currentNormLen;

    if (origCharLen > 1) {
      origPos++;
    }
  }

  return {
    normalizedText,
    toOriginal,
    mapSpan(normIdx: number, normLen: number) {
      if (!toOriginal) return { origIdx: normIdx, origLen: normLen };
      const origIdx = toOriginal[normIdx] ?? normIdx;
      const normEnd = normIdx + normLen;
      let origEnd: number;
      if (normEnd >= normalizedText.length) {
        origEnd = original.length;
      } else {
        let k = normEnd;
        while (k < normalizedText.length && toOriginal[k] === toOriginal[normEnd - 1]) {
            k++;
        }
        origEnd = k < normalizedText.length ? toOriginal[k] : original.length;
      }
      return { origIdx, origLen: origEnd - origIdx };
    },
  };
}

/**
 * Unicode-safe, case-insensitive search in `text` for `needle`.
 *
 * Both strings are NFC-normalized and lowercased before comparison.
 * The returned index and matchLength refer to positions in the
 * **original** `text` string, accounting for any length changes
 * introduced by case folding.
 *
 * @param text     — The haystack (original text, not pre-normalized)
 * @param needle   — The search term (original, not pre-normalized)
 * @param fromIndex — Start searching from this position in the original string.
 *                    Internally mapped to the normalized coordinate space.
 * @returns Match info with original-string coordinates, or null if not found.
 */
export function unicodeIndexOf(
  text: string,
  needle: string,
  fromIndex = 0,
): UnicodeSearchMatch | null {
  if (!needle) return null;

  const normNeedle = normalizeForSearch(needle);
  if (!normNeedle) return null;

  const { normalizedText, mapSpan, toOriginal } = buildNormMap(text);

  // Translate fromIndex (original coords) to normalized coords
  let normFromIndex = fromIndex;
  if (toOriginal && fromIndex > 0) {
    // Find the first normalized position whose original position >= fromIndex
    normFromIndex = 0;
    for (let i = 0; i < normalizedText.length; i++) {
      if ((toOriginal[i] ?? 0) >= fromIndex) {
        normFromIndex = i;
        break;
      }
      normFromIndex = normalizedText.length; // past end
    }
  }

  const normIdx = normalizedText.indexOf(normNeedle, normFromIndex);
  if (normIdx === -1) return null;

  const { origIdx, origLen } = mapSpan(normIdx, normNeedle.length);
  return { index: origIdx, matchLength: origLen };
}

/**
 * Find all non-overlapping matches of `needle` in `text`.
 * Returns matches in order of occurrence.
 */
export function unicodeFindAll(
  text: string,
  needle: string,
  maxResults = Infinity,
): UnicodeSearchMatch[] {
  if (!needle || !text) return [];

  const normNeedle = normalizeForSearch(needle);
  if (!normNeedle) return [];

  const { normalizedText, mapSpan } = buildNormMap(text);
  const results: UnicodeSearchMatch[] = [];
  let normPos = 0;

  while (normPos <= normalizedText.length - normNeedle.length && results.length < maxResults) {
    const normIdx = normalizedText.indexOf(normNeedle, normPos);
    if (normIdx === -1) break;

    const { origIdx, origLen } = mapSpan(normIdx, normNeedle.length);
    results.push({ index: origIdx, matchLength: origLen });

    // Advance past this match (in normalized space)
    normPos = normIdx + normNeedle.length;
  }

  return results;
}

/**
 * Pre-normalize text for repeated searches against the same haystack.
 * Returns the normalized string and the mapping utilities.
 * The caller can then use `indexOfInNormalized()` for each query.
 */
export function prepareHaystack(text: string) {
  const map = buildNormMap(text);
  return {
    normalizedText: map.normalizedText,
    indexOf(needle: string, normFromIndex = 0): UnicodeSearchMatch | null {
      const normNeedle = normalizeForSearch(needle);
      if (!normNeedle) return null;

      const normIdx = map.normalizedText.indexOf(normNeedle, normFromIndex);
      if (normIdx === -1) return null;

      const { origIdx, origLen } = map.mapSpan(normIdx, normNeedle.length);
      return { index: origIdx, matchLength: origLen };
    },
    /**
     * Search using a pre-normalized needle, returning the next normalized-space
     * position to continue searching from (for looping).
     */
    indexOfNormalized(
      normNeedle: string,
      normFromIndex = 0,
    ): { match: UnicodeSearchMatch; nextNormIndex: number } | null {
      const normIdx = map.normalizedText.indexOf(normNeedle, normFromIndex);
      if (normIdx === -1) return null;

      const { origIdx, origLen } = map.mapSpan(normIdx, normNeedle.length);
      return {
        match: { index: origIdx, matchLength: origLen },
        nextNormIndex: normIdx + normNeedle.length,
      };
    },
  };
}
