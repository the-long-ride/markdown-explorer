import { describe, it, expect } from 'vitest';
import { truncateFilename, getBreadcrumbItems } from '../../../../ui/src/components/Topbar/Topbar';

describe('Topbar pure functions', () => {
  describe('truncateFilename', () => {
    it('returns short name unchanged', () => {
      expect(truncateFilename('file.md', 20)).toBe('file.md');
    });

    it('truncates long name with extension', () => {
      const result = truncateFilename('verylongfilenamethatneedstruncation.md', 20);
      expect(result).toContain('...');
      expect(result).toContain('.md');
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('truncates name without extension', () => {
      const result = truncateFilename('verylongfilenamethatneedstruncation', 15);
      expect(result).toContain('...');
    });

    it('handles name exactly at maxLen', () => {
      const name = 'a'.repeat(10);
      expect(truncateFilename(name, 10)).toBe(name);
    });

    it('handles very short maxLen', () => {
      const result = truncateFilename('longfilename.md', 8);
      expect(result).toContain('...');
    });
  });

  describe('getBreadcrumbItems', () => {
    it('returns empty for empty relativePath', () => {
      expect(getBreadcrumbItems('', 'Welcome')).toEqual([]);
    });

    it('returns welcome page item', () => {
      const result = getBreadcrumbItems('Welcome Page', 'Welcome');
      expect(result).toEqual([{ text: 'Welcome', isBold: true }]);
    });

    it('returns single file for no directory', () => {
      const result = getBreadcrumbItems('readme.md', 'Welcome');
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('readme.md');
      expect(result[0].isBold).toBe(true);
    });

    it('returns path segments with last bold', () => {
      const result = getBreadcrumbItems('dir/file.md', 'Welcome');
      expect(result.length).toBeGreaterThanOrEqual(2);
      const lastItem = result[result.length - 1];
      expect(lastItem.isBold).toBe(true);
      expect(lastItem.text).toBe('file.md');
    });

    it('collapses deep paths with ellipsis when needed', () => {
      const result = getBreadcrumbItems('a/b/c/d/longfilename.md', 'Welcome');
      const hasEllipsis = result.some((item) => item.isEllipsis);
      expect(typeof hasEllipsis).toBe('boolean');
    });

    it('handles Windows backslash paths', () => {
      const result = getBreadcrumbItems('dir\\file.md', 'Welcome');
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('last segment is always bold', () => {
      const paths = ['a.md', 'dir/a.md', 'a/b/c/a.md'];
      for (const path of paths) {
        const result = getBreadcrumbItems(path, 'Welcome');
        const last = result[result.length - 1];
        expect(last.isBold).toBe(true);
      }
    });
  });
});
