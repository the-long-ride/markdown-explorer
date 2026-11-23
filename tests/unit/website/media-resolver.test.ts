import { describe, it, expect, vi } from 'vitest';
import { resolvePath, isExternalUrl, revokeAll, rewriteMediaUrls } from '../../../website-app/src/media-resolver';
import { memoryFile, MemoryFolder } from './memory-file-system';

it('rewrites local media and video posters, preserves other URLs, and revokes prior blobs', async () => {
  const root = new MemoryFolder('root');
  const docs = new MemoryFolder('docs');
  root.children.set('docs', docs);
  docs.children.set('clip.mp4', memoryFile('clip.mp4', 'video'));
  docs.children.set('poster.png', memoryFile('poster.png', 'image'));
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementationOnce(() => { throw new Error('Could not revoke'); });
  expect(await rewriteMediaUrls(root.asHandle(), [
    '<video poster="poster.png" src="clip.mp4"></video>',
    '<img src="https://example.test/remote.png">',
    '<img src="missing.png">',
  ].join(''), 'docs/notes.md')).toMatch(
    /^<video poster="blob:[^"]+" src="blob:[^"]+"><\/video><img src="https:\/\/example\.test\/remote\.png"><img src="missing\.png">$/,
  );
  expect(error).toHaveBeenCalledWith('Failed to resolve relative media path:', 'docs/missing.png', expect.any(Error));
  expect(await rewriteMediaUrls(root.asHandle(), '<p>text</p>', 'docs/notes.md')).toBe('<p>text</p>');
  expect(revoke).toHaveBeenCalledTimes(2);
  expect(error).toHaveBeenCalledWith('Error revoking blob URL:', expect.stringContaining('blob:'), expect.any(Error));
});

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
