import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDebugMode } from '../../../../ui/src/utils/supportPromptStore';

afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); sessionStorage.clear(); delete (window as any).__DEBUG__; });

describe('isDebugMode flags', () => {
  it('honours explicit and storage flags', () => {
    (window as any).__DEBUG__ = true;
    expect(isDebugMode()).toBe(true);
    delete (window as any).__DEBUG__;
    sessionStorage.setItem('debug', 'on');
    expect(isDebugMode()).toBe(true);
  });

  it('ignores falsy storage flags inside the test environment', () => {
    localStorage.setItem('markdown-explorer-debug', '0');
    expect(isDebugMode()).toBe(false);
  });
});
