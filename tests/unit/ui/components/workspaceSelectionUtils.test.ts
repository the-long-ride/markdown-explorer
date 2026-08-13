import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatLastOpened, isDesktopRuntime } from '../../../../ui/src/components/Workspace/workspaceSelectionUtils';

describe('workspaceSelectionUtils', () => {
  describe('formatLastOpened', () => {
    it('returns empty string for undefined', () => {
      expect(formatLastOpened(undefined)).toBe('');
    });

    it('returns empty string for 0', () => {
      expect(formatLastOpened(0)).toBe('');
    });

    it('returns localized now for very recent timestamp', () => {
      expect(formatLastOpened(Date.now(), 'en')).toBe('now');
    });

    it('returns minutes ago', () => {
      const fiveMinsAgo = Date.now() - 5 * 60000;
      expect(formatLastOpened(fiveMinsAgo, 'en')).toBe('5m ago');
    });

    it('returns hours ago', () => {
      const threeHoursAgo = Date.now() - 3 * 3600000;
      expect(formatLastOpened(threeHoursAgo, 'en')).toBe('3h ago');
    });

    it('returns days ago', () => {
      const threeDaysAgo = Date.now() - 3 * 86400000;
      expect(formatLastOpened(threeDaysAgo, 'en')).toBe('3d ago');
    });

    it('returns formatted date for 7+ days ago', () => {
      const tenDaysAgo = Date.now() - 10 * 86400000;
      const result = formatLastOpened(tenDaysAgo);
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns 1m ago for exactly 60 seconds ago', () => {
      const sixtySecondsAgo = Date.now() - 60000;
      expect(formatLastOpened(sixtySecondsAgo, 'en')).toBe('1m ago');
    });

    it('formats recent time using the selected locale', () => {
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
      expect(formatLastOpened(fiveMinsAgo, 'vi')).toContain('phút');
    });
  });

  describe('isDesktopRuntime', () => {
    beforeEach(() => {
      delete (window as any).electronAPI;
    });

    afterEach(() => {
      delete (window as any).electronAPI;
    });

    it('returns false when electronAPI is not defined', () => {
      expect(isDesktopRuntime()).toBe(false);
    });

    it('returns true when electronAPI is defined', () => {
      (window as any).electronAPI = {};
      expect(isDesktopRuntime()).toBe(true);
    });
  });
});
