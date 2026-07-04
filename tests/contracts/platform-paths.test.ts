import { describe, expect, test, vi } from 'vitest';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createMarkdownRenderer } = require('../../electron/render/markdown-renderer.js');

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

describe('desktop markdown-renderer', () => {
  test('fallback when parser not found', () => {
    const existsSyncSpy = vi.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
    const renderer = createMarkdownRenderer('/nonexistent/app');
    const result = renderer.render('/some/file.md', '# Hello\n\nWorld');

    expect(result.html).toContain('Hello');
    expect(result.html).toContain('World');
    expect(result.html).toContain('pre-wrap');
    expect(result.frontmatter).toEqual({});
    expect(result.toc).toEqual([]);

    existsSyncSpy.mockRestore();
  });

  test('fallback wraps raw content in div', () => {
    const existsSyncSpy = vi.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
    const renderer = createMarkdownRenderer('/nonexistent/app');
    const result = renderer.render('test.md', 'Just text');

    expect(result.html).toContain('Just text');
    expect(result.html).toMatch(/<div/);

    existsSyncSpy.mockRestore();
  });

  test('rewrites relative image src to file:/// URL', () => {
    const existsSyncSpy = vi.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
    const renderer = createMarkdownRenderer('/nonexistent/app');
    const htmlWithRelativeImg = '<img src="media/photo.png" />';
    const result = renderer.render('/home/user/docs/readme.md', htmlWithRelativeImg);

    expect(result.html).toContain('file:///');
    expect(result.html).toContain('photo.png');

    existsSyncSpy.mockRestore();
  });

  test('preserves absolute URLs in src attributes', () => {
    const existsSyncSpy = vi.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
    const renderer = createMarkdownRenderer('/nonexistent/app');
    const htmlWithAbsoluteUrl = '<img src="https://example.com/img.png" />';
    const result = renderer.render('/home/user/docs/readme.md', htmlWithAbsoluteUrl);

    expect(result.html).toContain('https://example.com/img.png');
    expect(result.html).not.toContain('file:///');

    existsSyncSpy.mockRestore();
  });

  test('preserves data: URLs in src attributes', () => {
    const existsSyncSpy = vi.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
    const renderer = createMarkdownRenderer('/nonexistent/app');
    const htmlWithDataUrl = '<img src="data:image/png;base64,abc" />';
    const result = renderer.render('/home/user/docs/readme.md', htmlWithDataUrl);

    expect(result.html).toContain('data:image/png;base64,abc');

    existsSyncSpy.mockRestore();
  });

  test('rewrites video poster path to file:/// URL', () => {
    const existsSyncSpy = vi.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
    const renderer = createMarkdownRenderer('/nonexistent/app');
    const htmlWithPoster = '<video poster="thumbnails/preview.jpg"></video>';
    const result = renderer.render('/home/user/docs/readme.md', htmlWithPoster);

    expect(result.html).toContain('file:///');
    expect(result.html).toContain('preview.jpg');

    existsSyncSpy.mockRestore();
  });
});
