function normalizeForSearch(text) {
  return text.normalize('NFC').toLocaleUpperCase().toLocaleLowerCase().replace(/\u0307/g, '');
}

function identityMapSpan(normIdx, normLen) {
  return { origIdx: normIdx, origLen: normLen };
}

function computeOrigEnd(toOriginal, normalizedText, original, normEnd) {
  if (normEnd >= normalizedText.length) {
    return original.length;
  }
  let k = normEnd;
  while (k < normalizedText.length && toOriginal[k] === toOriginal[normEnd - 1]) {
    k++;
  }
  return k < normalizedText.length ? toOriginal[k] : original.length;
}

function mappingMapSpan(toOriginal, normalizedText, original, normIdx, normLen) {
  if (!toOriginal) return { origIdx: normIdx, origLen: normLen };
  const origIdx = toOriginal[normIdx] ?? normIdx;
  const normEnd = normIdx + normLen;
  const origEnd = computeOrigEnd(toOriginal, normalizedText, original, normEnd);
  return { origIdx, origLen: origEnd - origIdx };
}

/** Marks and Hangul medial/final jamo compose with the preceding character under NFC. */
const COMBINING_SEQUENCE_CONTINUATION = /[\p{M}ᅠ-ᇿힰ-퟿]/u;

function buildNormMap(original) {
  const normalizedText = normalizeForSearch(original);

  if (normalizedText.length === original.length) {
    return {
      normalizedText,
      toOriginal: null,
      mapSpan(normIdx, normLen) {
        return identityMapSpan(normIdx, normLen);
      },
    };
  }

  const toOriginal = new Uint32Array(normalizedText.length);
  // Normalize per combining sequence (a starter plus its marks) instead of the
  // whole growing prefix: the prefix approach was O(n^2) and froze workspace
  // search on large decomposed (macOS NFD) documents.
  let segment = '';
  let segmentStartNormLen = 0;
  let lastNormLen = 0;

  for (let origPos = 0; origPos < original.length; origPos++) {
    const origChar = String.fromCodePoint(original.codePointAt(origPos));
    if (segment && !COMBINING_SEQUENCE_CONTINUATION.test(origChar)) {
      segmentStartNormLen += normalizeForSearch(segment).length;
      segment = '';
    }
    segment += origChar;
    const currentNormLen = segmentStartNormLen + normalizeForSearch(segment).length;

    for (let k = lastNormLen; k < currentNormLen && k < normalizedText.length; k++) {
      toOriginal[k] = origPos;
    }

    lastNormLen = currentNormLen;

    if (origChar.length > 1) {
      origPos++;
    }
  }

  return {
    normalizedText,
    toOriginal,
    mapSpan(normIdx, normLen) {
      return mappingMapSpan(toOriginal, normalizedText, original, normIdx, normLen);
    },
  };
}

function haystackIndexOf(map, needle, normFromIndex) {
  const normNeedle = normalizeForSearch(needle);
  if (!normNeedle) return null;

  const normIdx = map.normalizedText.indexOf(normNeedle, normFromIndex);
  if (normIdx === -1) return null;

  const { origIdx, origLen } = map.mapSpan(normIdx, normNeedle.length);
  return { index: origIdx, matchLength: origLen };
}

function haystackIndexOfNormalized(map, normNeedle, normFromIndex) {
  const normIdx = map.normalizedText.indexOf(normNeedle, normFromIndex);
  if (normIdx === -1) return null;

  const { origIdx, origLen } = map.mapSpan(normIdx, normNeedle.length);
  return {
    match: { index: origIdx, matchLength: origLen },
    nextNormIndex: normIdx + normNeedle.length,
  };
}

function prepareHaystack(text) {
  const map = buildNormMap(text);
  return {
    normalizedText: map.normalizedText,
    indexOf(needle, normFromIndex = 0) {
      return haystackIndexOf(map, needle, normFromIndex);
    },
    indexOfNormalized(normNeedle, normFromIndex = 0) {
      return haystackIndexOfNormalized(map, normNeedle, normFromIndex);
    },
  };
}

module.exports = {
  normalizeForSearch,
  prepareHaystack,
  buildNormMap,
  identityMapSpan,
  mappingMapSpan,
  computeOrigEnd,
  haystackIndexOf,
  haystackIndexOfNormalized,
};
