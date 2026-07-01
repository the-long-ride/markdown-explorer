import { describe, it, expect } from 'vitest';
import { resolvePath, isExternalUrl, revokeAll } from '../../../chromium-xtension/src/media-resolver';

describe('resolvePath', () => {
  it('resolves simple relative path', () => {
    expect(resolvePath('docs', 'image.png')).toBe('docs/image.png');
  });

  it('resolves with subdirectory', () => {
    expect(resolvePath('docs/guide', 'img/photo.png')).toBe('docs/guide/img/photo.png');
  });

  it('resolves parent directory reference', () => {
    expect(resolvePath('docs/guide', '../shared/data.png')).toBe('docs/shared/data.png');
  });

  it('resolves multiple parent references', () => {
    expect(resolvePath('a/b/c', '../../x.png')).toBe('a/x.png');
  });

  it('resolves current directory reference', () => {
    expect(resolvePath('docs', './image.png')).toBe('docs/image.png');
  });

  it('resolves absolute path (leading slash)', () => {
    expect(resolvePath('docs/guide', '/assets/img.png')).toBe('assets/img.png');
  });

  it('handles backslash paths', () => {
    expect(resolvePath('docs\\guide', '..\\shared\\img.png')).toBe('docs/shared/img.png');
  });

  it('handles backslash in base path', () => {
    expect(resolvePath('docs\\guide', 'img.png')).toBe('docs/guide/img.png');
  });

  it('resolves parent beyond root gracefully', () => {
    expect(resolvePath('docs', '../../image.png')).toBe('image.png');
  });

  it('resolves empty relative path', () => {
    expect(resolvePath('docs/guide', '')).toBe('docs/guide');
  });

  it('resolves dot only', () => {
    expect(resolvePath('docs', '.')).toBe('docs');
  });

  it('handles double dots only', () => {
    expect(resolvePath('a/b', '..')).toBe('a');
  });
});

describe('isExternalUrl', () => {
  it('identifies http URLs', () => {
    expect(isExternalUrl('http://example.com/img.png')).toBe(true);
  });

  it('identifies https URLs', () => {
    expect(isExternalUrl('https://example.com/img.png')).toBe(true);
  });

  it('identifies data URIs', () => {
    expect(isExternalUrl('data:image/png;base64,abc')).toBe(true);
  });

  it('identifies file URLs', () => {
    expect(isExternalUrl('file:///home/user/img.png')).toBe(true);
  });

  it('identifies blob URLs', () => {
    expect(isExternalUrl('blob:uuid-123')).toBe(true);
  });

  it('identifies vscode-webview URLs', () => {
    expect(isExternalUrl('vscode-webview://img.png')).toBe(true);
  });

  it('identifies fragment-only URLs', () => {
    expect(isExternalUrl('#section')).toBe(true);
  });

  it('does not identify relative paths as external', () => {
    expect(isExternalUrl('images/photo.png')).toBe(false);
  });

  it('does not identify parent-relative paths as external', () => {
    expect(isExternalUrl('../img.png')).toBe(false);
  });

  it('does not identify dot-prefixed paths as external', () => {
    expect(isExternalUrl('./img.png')).toBe(false);
  });

  it('case-insensitive match for HTTP', () => {
    expect(isExternalUrl('HTTP://example.com')).toBe(true);
  });

  it('case-insensitive match for DATA', () => {
    expect(isExternalUrl('DATA:image/png;base64,abc')).toBe(true);
  });
});

describe('revokeAll', () => {
  it('does not throw when no blob URLs are active', () => {
    expect(() => revokeAll()).not.toThrow();
  });
});
