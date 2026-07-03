import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useIsDark } from '../../../../ui/src/hooks/useIsDark';

describe('useIsDark', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns true when theme is dark', () => {
    expect(useIsDark('dark')).toBe(true);
  });

  it('returns false when theme is light', () => {
    expect(useIsDark('light')).toBe(false);
  });

  it('returns true when theme is auto and system prefers dark', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true } as MediaQueryList);
    expect(useIsDark('auto')).toBe(true);
  });

  it('returns false when theme is auto and system prefers light', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false } as MediaQueryList);
    expect(useIsDark('auto')).toBe(false);
  });
});
