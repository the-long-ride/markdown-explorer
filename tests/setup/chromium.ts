import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

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

let objectUrlCounter = 0;
const objectUrls = new Map<string, Blob>();

beforeEach(() => {
  if (typeof globalThis.URL?.createObjectURL === 'undefined' || typeof globalThis.URL?.createObjectURL === 'function') {
    const origCreateObjectURL = globalThis.URL?.createObjectURL;
    const origRevokeObjectURL = globalThis.URL?.revokeObjectURL;
    vi.stubGlobal('URL', {
      ...globalThis.URL,
      createObjectURL: (blob: Blob) => {
        const url = `blob:chrome-extension://fake-${++objectUrlCounter}`;
        objectUrls.set(url, blob);
        return url;
      },
      revokeObjectURL: (url: string) => {
        objectUrls.delete(url);
      },
    });
  }
});

afterEach(() => {
  objectUrls.clear();
  objectUrlCounter = 0;
});
