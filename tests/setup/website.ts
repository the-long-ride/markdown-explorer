import 'fake-indexeddb/auto';
import './dom';
import { afterEach, beforeEach } from 'vitest';

let objectUrlCounter = 0;
const objectUrls = new Map<string, Blob>();
const origCreateObjectURL = globalThis.URL?.createObjectURL;
const origRevokeObjectURL = globalThis.URL?.revokeObjectURL;

beforeEach(() => {
  if (globalThis.URL) {
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: (blob: Blob) => {
        const url = `blob:web://fake-${++objectUrlCounter}`;
        objectUrls.set(url, blob);
        return url;
      },
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: (url: string) => {
        objectUrls.delete(url);
      },
    });
  }
});

afterEach(() => {
  objectUrls.clear();
  objectUrlCounter = 0;
  if (globalThis.URL && origCreateObjectURL) {
    Object.defineProperty(globalThis.URL, 'createObjectURL', { configurable: true, writable: true, value: origCreateObjectURL });
  }
  if (globalThis.URL && origRevokeObjectURL) {
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', { configurable: true, writable: true, value: origRevokeObjectURL });
  }
});
