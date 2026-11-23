import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDebugMode } from '../../../../ui/src/utils/supportPromptStore';

afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); });

describe('isDebugMode url flags', () => {
  it('honours url debug params', () => {
    const original = window.location.href;
    window.history.replaceState(null, '', '?debug=1');
    expect(isDebugMode()).toBe(true);
    window.history.replaceState(null, '', '?mode=debug');
    expect(isDebugMode()).toBe(true);
    window.history.replaceState(null, '', '?debug=0#debug');
    expect(isDebugMode()).toBe(true);
    window.history.replaceState(null, '', original);
  });
});
