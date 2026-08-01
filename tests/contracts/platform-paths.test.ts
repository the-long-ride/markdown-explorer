import { describe, expect, test } from 'vitest';
import path from 'node:path';

describe('platform paths', () => {
  describe('path.win32', () => {
    test('resolves relative media path on Windows', () => {
      const result = path.win32.resolve('C:\\docs', 'media\\image.png');
      expect(result).toBe('C:\\docs\\media\\image.png');
    });

    test('dirname extracts directory from path', () => {
      expect(path.win32.dirname('C:\\docs\\readme.md')).toBe('C:\\docs');
    });
  });

  describe('path.posix', () => {
    test('resolves relative media path on POSIX', () => {
      const result = path.posix.resolve('/home/user/docs', 'media/image.png');
      expect(result).toBe('/home/user/docs/media/image.png');
    });

    test('dirname extracts directory from path', () => {
      expect(path.posix.dirname('/home/user/docs/readme.md')).toBe('/home/user/docs');
    });
  });

  describe('file:// URL construction', () => {
    test('Windows path produces file:/// with forward slashes', () => {
      const winPath = 'C:\\docs\\media\\image.png';
      const fileUrl = 'file:///' + winPath.replace(/\\/g, '/');
      expect(fileUrl).toBe('file:///C:/docs/media/image.png');
    });

    test('POSIX path produces file:/// URL', () => {
      const posixPath = '/home/user/docs/media/image.png';
      const fileUrl = 'file://' + posixPath;
      expect(fileUrl).toBe('file:///home/user/docs/media/image.png');
    });
  });
});
