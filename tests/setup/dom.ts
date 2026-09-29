import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// CodeMirror measures DOM Range geometry after editor updates. jsdom exposes
// Range but does not implement these layout methods, so provide zero-sized
// geometry for tests; browser runtimes continue using their native methods.
if (typeof Range !== 'undefined') {
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(),
    });
  }
  if (typeof Range.prototype.getClientRects !== 'function') {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* iterator() {},
      } as DOMRectList),
    });
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
});
