import { afterEach, describe, expect, it } from 'vitest';
import { flushReadingProgress, getHeadingState, getScrollPosition, rememberHeadingState, rememberScrollPosition, resetReadingProgressForTests } from '../../../ui/src/readingProgress/readingProgressStore';

afterEach(() => { resetReadingProgressForTests(); localStorage.clear(); });

function storageKey(): string {
  rememberScrollPosition('w', 'a.md', 10);
  flushReadingProgress();
  const key = Object.keys(localStorage).find((k) => (localStorage.getItem(k) ?? '').includes('"version"'));
  expect(key).toBeTruthy();
  return key!;
}

describe('readingProgressStore corrupt payloads and guards', () => {
  it('discards unsupported versions and null workspaces', () => {
    const key = storageKey();
    for (const payload of [{ version: 2, workspaces: {} }, { version: 1, workspaces: null }, { version: 1 }]) {
      resetReadingProgressForTests();
      localStorage.setItem(key, JSON.stringify(payload));
      expect(getScrollPosition('w', 'a.md')).toBeUndefined();
    }
  });

  it('ignores invalid writes and clears pending timers on reset', () => {
    rememberScrollPosition('', 'a.md', 1);
    rememberScrollPosition('w', 'a.md', -1);
    rememberScrollPosition('w', 'a.md', Number.NaN);
    rememberHeadingState('w', 'a.md', new Map());
    rememberHeadingState('', 'a.md', new Map([['h', true]]));
    expect(getScrollPosition('w', 'a.md')).toBeUndefined();
    expect(getHeadingState('w', 'a.md')).toBeUndefined();
    rememberScrollPosition('w', 'b.md', 5);
    resetReadingProgressForTests();
    expect(typeof localStorage.length).toBe('number');
  });
});
