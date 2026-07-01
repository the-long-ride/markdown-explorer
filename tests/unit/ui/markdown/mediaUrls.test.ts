import { describe, it, expect } from 'vitest';
import { toFileResourceUrl, rewriteRelativeMediaUrls } from '../../../../ui/src/markdown/mediaUrls';

describe('markdown/mediaUrls', () => {
  describe('toFileResourceUrl', () => {
    it('returns https: URLs unchanged', () => {
      expect(toFileResourceUrl('/path/to/doc.md', 'https://img.com/pic.png')).toBe('https://img.com/pic.png');
    });

    it('returns data: URLs unchanged', () => {
      expect(toFileResourceUrl('/path/to/doc.md', 'data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    });

    it('returns file: URLs unchanged', () => {
      expect(toFileResourceUrl('/path/to/doc.md', 'file:///existing/path.png')).toBe('file:///existing/path.png');
    });

    it('returns blob: URLs unchanged', () => {
      expect(toFileResourceUrl('/path/to/doc.md', 'blob:abc123')).toBe('blob:abc123');
    });

    it('returns vscode-webview: URLs unchanged', () => {
      expect(toFileResourceUrl('/path/to/doc.md', 'vscode-webview://resource')).toBe('vscode-webview://resource');
    });

    it('returns anchor-only URLs unchanged', () => {
      expect(toFileResourceUrl('/path/to/doc.md', '#anchor')).toBe('#anchor');
    });

    it('resolves relative path to file:// URL', () => {
      const result = toFileResourceUrl('/home/user/docs/note.md', 'image.png');
      expect(result).toBe('file:///home/user/docs/image.png');
    });

    it('handles .. in relative path', () => {
      const result = toFileResourceUrl('/home/user/docs/note.md', '../assets/img.png');
      expect(result).toBe('file:///home/user/assets/img.png');
    });

    it('handles . in relative path', () => {
      const result = toFileResourceUrl('/home/user/docs/note.md', './image.png');
      expect(result).toBe('file:///home/user/docs/image.png');
    });

    it('handles Windows backslash paths', () => {
      const result = toFileResourceUrl('C:\\Users\\docs\\note.md', 'image.png');
      expect(result).toBe('file:///C:/Users/docs/image.png');
    });

    it('handles absolute path in relative parameter', () => {
      const result = toFileResourceUrl('/home/user/docs/note.md', '/absolute/path.png');
      expect(result).toContain('absolute/path.png');
    });

    it('handles Windows absolute path', () => {
      const result = toFileResourceUrl('C:\\Users\\docs\\note.md', 'D:\\images\\pic.png');
      expect(result).toContain('pic.png');
    });

    it('handles deep directory traversal', () => {
      const result = toFileResourceUrl('/a/b/c/d/note.md', '../../img.png');
      expect(result).toBe('file:///a/b/img.png');
    });

    it('handles file in current directory (no subpath)', () => {
      const mdPath = 'note.md';
      const result = toFileResourceUrl(mdPath, 'image.png');
      expect(result).toContain('image.png');
    });
  });

  describe('rewriteRelativeMediaUrls', () => {
    it('returns html unchanged when markdownFilePath is empty', () => {
      expect(rewriteRelativeMediaUrls('<img src="x.png"/>', '')).toBe('<img src="x.png"/>');
    });

    it('rewrites img src', () => {
      const html = '<img src="image.png" />';
      const result = rewriteRelativeMediaUrls(html, '/home/user/docs/note.md');
      expect(result).toContain('file:///home/user/docs/image.png');
    });

    it('rewrites video src', () => {
      const html = '<video src="vid.mp4"></video>';
      const result = rewriteRelativeMediaUrls(html, '/home/user/docs/note.md');
      expect(result).toContain('file:///home/user/docs/vid.mp4');
    });

    it('rewrites source src', () => {
      const html = '<source src="video.webm" />';
      const result = rewriteRelativeMediaUrls(html, '/home/user/docs/note.md');
      expect(result).toContain('file:///home/user/docs/video.webm');
    });

    it('rewrites track src', () => {
      const html = '<track src="subs.vtt" />';
      const result = rewriteRelativeMediaUrls(html, '/home/user/docs/note.md');
      expect(result).toContain('file:///home/user/docs/subs.vtt');
    });

    it('rewrites video poster', () => {
      const html = '<video poster="thumb.jpg"></video>';
      const result = rewriteRelativeMediaUrls(html, '/home/user/docs/note.md');
      expect(result).toContain('file:///home/user/docs/thumb.jpg');
    });

    it('does not rewrite https: URLs', () => {
      const html = '<img src="https://example.com/img.png" />';
      const result = rewriteRelativeMediaUrls(html, '/home/user/docs/note.md');
      expect(result).toContain('https://example.com/img.png');
    });

    it('handles single-quoted attributes', () => {
      const html = "<img src='image.png' />";
      const result = rewriteRelativeMediaUrls(html, '/home/user/docs/note.md');
      expect(result).toContain('file:///home/user/docs/image.png');
    });
  });
});
