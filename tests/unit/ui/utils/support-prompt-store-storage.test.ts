import { describe, expect, it } from 'vitest';
import { getDefaultSupportPromptState, loadSupportPromptState, recordSupportPromptShown } from '../../../../ui/src/utils/supportPromptStore';

const storageWith = (value: string | null) => {
  const data = new Map<string, string>();
  return { getItem: () => value, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: () => {}, data } as any;
};

describe('support prompt storage parsing', () => {
  it('returns defaults for non-object stored state', () => {
    for (const value of ['null', '5', '"x"']) expect(loadSupportPromptState(storageWith(value))).toEqual(getDefaultSupportPromptState());
  });
  it('records a shown prompt from a provided state', () => {
    const storage = storageWith(null);
    const next = recordSupportPromptShown({ ...getDefaultSupportPromptState(), totalUsageMs: 5 } as any, storage);
    expect(next.totalUsageMs).toBe(5);
    expect(storage.data.size).toBe(1);
  });
});
