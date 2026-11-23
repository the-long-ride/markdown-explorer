import { describe, expect, it } from 'vitest';
import { normalizeForSearch, unicodeIndexOf } from '../../../../ui/src/utils/unicodeSearch';

describe('unicodeIndexOf with normalized haystacks and fromIndex', () => {
  it('maps fromIndex into normalized text and past the end', () => {
    const text = 'Cafe\u0301 and cafe\u0301 again';
    const needle = normalizeForSearch('café');
    const first = unicodeIndexOf(text, needle, 0) as any;
    expect(first).not.toBeNull();
    const later = unicodeIndexOf(text, needle, 3) as any;
    expect(later).not.toBeNull();
    expect(JSON.stringify(later)).not.toBe(JSON.stringify(first));
    expect(unicodeIndexOf(text, needle, text.length + 5)).toBeNull();
  });
});
