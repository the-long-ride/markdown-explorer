// =============================================================================
// desktop/unicode-search.js — Unicode-safe, multilingual search utilities
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
 */
function normalizeForSearch(text) {
  // We apply NFC first, uppercase, then lowercase, then strip the combining dot above (\u0307)
  // which is produced by `toLocaleLowerCase()` on a Turkish İ to preserve its dotted state
  // in locale-agnostic environments. This ensures 'istanbul' matches 'İstanbul',
  // and 'strasse' matches 'straße'.
  return text.normalize('NFC').toLocaleUpperCase().toLocaleLowerCase().replace(/\u0307/g, '');
}

/**
 * Build a mapping from positions in the normalized-lower string back
 * to positions in the original string.
 */
function buildNormMap(original) {
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
    const codePoint = original.codePointAt(origPos);
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
    mapSpan(normIdx, normLen) {
      if (!toOriginal) return { origIdx: normIdx, origLen: normLen };
      const origIdx = toOriginal[normIdx] ?? normIdx;
      const normEnd = normIdx + normLen;
      let origEnd;
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
 * Pre-normalize text for repeated searches against the same haystack.
 */
function prepareHaystack(text) {
  const map = buildNormMap(text);
  return {
    normalizedText: map.normalizedText,
    indexOf(needle, normFromIndex = 0) {
      const normNeedle = normalizeForSearch(needle);
      if (!normNeedle) return null;

      const normIdx = map.normalizedText.indexOf(normNeedle, normFromIndex);
      if (normIdx === -1) return null;

      const { origIdx, origLen } = map.mapSpan(normIdx, normNeedle.length);
      return { index: origIdx, matchLength: origLen };
    },
    indexOfNormalized(normNeedle, normFromIndex = 0) {
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

module.exports = {
  normalizeForSearch,
  prepareHaystack,
  buildNormMap
};
