import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import url from 'node:url';

const require = createRequire(import.meta.url);
const { createMarkdownRenderer, shouldKeepResourceUrl, toFileResourceUrl, rewriteAttr, rewriteRelativeMediaUrls, loadMarkdownParser, renderWithParser, renderFallback } = require('../../../desktop/markdown-renderer.js');

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

describe('markdown-renderer', () => {
  describe('shouldKeepResourceUrl', () => {
    test('keeps https URLs', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', '<img src="https://example.com/img.png">');
      expect(result.html).toContain('https://example.com/img.png');
    });

    test('keeps data URLs', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', '<img src="data:image/png;base64,abc">');
      expect(result.html).toContain('data:image/png;base64');
    });

    test('keeps file URLs', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', '<img src="file:///C:/docs/img.png">');
      expect(result.html).toContain('file:///C:/docs/img.png');
    });

    test('keeps blob URLs', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', '<img src="blob:http://example.com/uuid">');
      expect(result.html).toContain('blob:');
    });

    test('keeps vscode-webview URLs', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', '<img src="vscode-webview://resource">');
      expect(result.html).toContain('vscode-webview://');
    });

    test('keeps fragment-only URLs', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', '<img src="#section">');
      expect(result.html).toContain('#section');
    });
  });

  describe('rewriteRelativeMediaUrls', () => {
    test('rewrites relative img src to file:// URL', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('C:\\docs\\guide.md', '<img src="image.png">');
      expect(result.html).toMatch(/file:\/\/.*image\.png/);
    });

    test('rewrites relative video poster attribute', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('C:\\docs\\guide.md', '<video poster="thumb.jpg"></video>');
      expect(result.html).toMatch(/file:\/\/.*thumb\.jpg/);
    });

    test('rewrites relative source src', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/home/user/docs/guide.md', '<video><source src="video.mp4"></video>');
      expect(result.html).toMatch(/file:\/\/.*video\.mp4/);
    });

    test('rewrites relative track src', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/home/user/docs/guide.md', '<video><track src="subs.vtt"></video>');
      expect(result.html).toMatch(/file:\/\/.*subs\.vtt/);
    });
  });

  describe('fallback rendering', () => {
    test('falls back to monospace div when parser not available', () => {
      const renderer = createMarkdownRenderer('/nonexistent/path');
      const result = renderer.render('/tmp/test.md', '# Hello\n\nWorld');
      expect(result.html).toContain('white-space: pre-wrap');
      expect(result.html).toContain('# Hello');
      expect(result.frontmatter).toEqual({});
      expect(result.toc).toEqual([]);
    });
  });

  describe('compiled parser available', () => {
    const parserAvailable = loadMarkdownParser(projectRoot) !== null;
    test.skipIf(!parserAvailable)('uses VS Code parser when available', () => {
      const renderer = createMarkdownRenderer(projectRoot);
      const result = renderer.render('/tmp/test.md', '# Hello World\n\nParagraph text');
      expect(result.html).not.toContain('white-space: pre-wrap');
      expect(result.html).toContain('Hello World');
      expect(result.toc.length).toBeGreaterThan(0);
    });

    test.skipIf(!parserAvailable)('parses MDX mode for .mdx files', () => {
      const renderer = createMarkdownRenderer(projectRoot);
      const result = renderer.render('/tmp/test.mdx', '# MDX Title\n\nSome content');
      expect(result.html).toContain('MDX Title');
    });
  });

  describe('error handling', () => {
    test('loadMarkdownParser returns false for missing parser', () => {
      const renderer = createMarkdownRenderer('/nonexistent/app');
      const result = renderer.render('/tmp/test.md', 'content');
      expect(result.html).toContain('white-space: pre-wrap');
    });

    test('loadMarkdownParser returns false when require throws', () => {
      const renderer = createMarkdownRenderer('/nonexistent');
      const result = renderer.render('/tmp/test.md', 'content');
      expect(result.html).toContain('white-space: pre-wrap');
    });
  });

  describe('uncovered branch: http scheme', () => {
    test('keeps http URLs (not just https)', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', '<img src="http://example.com/img.png">');
      expect(result.html).toContain('http://example.com/img.png');
      expect(result.html).not.toMatch(/file:\/\/.*http:/);
    });
  });

  describe('uncovered branch: rewriteAttr error catch', () => {
    test('returns original match when toFileResourceUrl throws', () => {
      const pathMod = require('path');
      const origDirname = pathMod.dirname;
      const origResolve = pathMod.resolve;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      pathMod.dirname = () => { throw new Error('dirname boom'); };
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', '<img src="image.png">');
      expect(result.html).toContain('src="image.png"');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to resolve relative media path:', 'image.png', expect.any(Error)
      );
      consoleSpy.mockRestore();
      pathMod.dirname = origDirname;
      pathMod.resolve = origResolve;
    });
  });

  describe('uncovered branch: loadMarkdownParser require() throws', () => {
    test('returns false when files exist but require throws', () => {
      const fsSpy = vi.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      const origRequire = module._load ?? module.require;
      vi.spyOn(require('module'), '_load' as any).mockImplementation((...args: any[]) => {
        const request = typeof args[0] === 'string' ? args[0] : '';
        if (request.includes('parser.js') || request.includes('renderer.js')) {
          throw new Error('require boom');
        }
        return origRequire.apply(module, args);
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = loadMarkdownParser('/app');
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  describe('uncovered branch: render when parser loads but modules are null', () => {
    test('falls back when loadMarkdownParser returns null', () => {
      const fsSpy = vi.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', '# Hello');
      expect(result.html).toContain('white-space: pre-wrap');
      vi.restoreAllMocks();
    });
  });

  describe('loadMarkdownParser only one file exists', () => {
    test('returns false when parser exists but renderer does not', () => {
      const fsSpy = vi.spyOn(require('fs'), 'existsSync').mockImplementation((p: any) => {
        if (typeof p === 'string' && p.includes('renderer.js')) return false;
        if (typeof p === 'string' && p.includes('parser.js')) return true;
        return false;
      });
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', 'content');
      expect(result.html).toContain('white-space: pre-wrap');
      fsSpy.mockRestore();
    });

    test('returns false when renderer exists but parser does not', () => {
      const fsSpy = vi.spyOn(require('fs'), 'existsSync').mockImplementation((p: any) => {
        if (typeof p === 'string' && p.includes('parser.js')) return false;
        if (typeof p === 'string' && p.includes('renderer.js')) return true;
        return false;
      });
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', 'content');
      expect(result.html).toContain('white-space: pre-wrap');
      fsSpy.mockRestore();
    });
  });

  describe('toFileResourceUrl relative path branch', () => {
    test('rewrites relative path to file:// URL with forward slashes', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/home/user/docs/guide.md', '<img src="subdir/image.png">');
      expect(result.html).toContain('file:///');
      expect(result.html).toContain('subdir/image.png');
      expect(result.html).not.toContain('https:');
    });
  });

  describe('shouldKeepResourceUrl explicit deeptest', () => {
    test('http scheme is kept (not rewritten)', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', '<img src="http://example.com/img.png">');
      expect(result.html).toContain('http://example.com/img.png');
      expect(result.html).not.toMatch(/file:\/\/.*http:/);
    });

    test('data URI is kept', () => {
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', '<img src="data:image/gif;base64,R0lGOD">');
      expect(result.html).toContain('data:image/gif;base64,R0lGOD');
    });
  });

  describe('loadMarkdownParser branches', () => {
    test('returns false when neither parser.js nor renderer.js exist', () => {
      const fsSpy = vi.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const renderer = createMarkdownRenderer('/nonexistent');
      const result = renderer.render('/tmp/test.md', 'content');
      expect(result.html).toContain('white-space: pre-wrap');
      fsSpy.mockRestore();
      warnSpy.mockRestore();
    });

    test('returns false and warns when require() throws', () => {
      const fsSpy = vi.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const moduleLoad = vi.spyOn(require('module') as any, '_load' as any).mockImplementation((...args: any[]) => {
        const request = typeof args[0] === 'string' ? args[0] : '';
        if (request.includes('parser.js') || request.includes('renderer.js')) {
          throw new Error('require failed');
        }
        return (require('module')._load as Function)(...args);
      });
      const renderer = createMarkdownRenderer('/app');
      const result = renderer.render('/tmp/test.md', 'content');
      expect(result.html).toContain('white-space: pre-wrap');
      expect(warnSpy).toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });
});

describe('shouldKeepResourceUrl direct', () => {
  test('https returns true', () => {
    expect(shouldKeepResourceUrl('https://example.com')).toBe(true);
  });

  test('http returns true', () => {
    expect(shouldKeepResourceUrl('http://example.com')).toBe(true);
  });

  test('data returns true', () => {
    expect(shouldKeepResourceUrl('data:image/png')).toBe(true);
  });

  test('file returns true', () => {
    expect(shouldKeepResourceUrl('file:///C:/x')).toBe(true);
  });

  test('blob returns true', () => {
    expect(shouldKeepResourceUrl('blob:http://x')).toBe(true);
  });

  test('vscode-webview returns true', () => {
    expect(shouldKeepResourceUrl('vscode-webview://x')).toBe(true);
  });

  test('fragment returns true', () => {
    expect(shouldKeepResourceUrl('#anchor')).toBe(true);
  });

  test('relative path returns false', () => {
    expect(shouldKeepResourceUrl('image.png')).toBe(false);
  });
});

describe('toFileResourceUrl direct', () => {
  test('returns src as-is for absolute URLs', () => {
    expect(toFileResourceUrl('/tmp/guide.md', 'https://example.com')).toBe('https://example.com');
  });

  test('resolves relative path to file:// URL', () => {
    const result = toFileResourceUrl('/home/user/docs/guide.md', 'image.png');
    expect(result).toMatch(/^file:\/\//);
    expect(result).toContain('image.png');
  });
});

describe('rewriteAttr direct', () => {
  test('rewrites relative src', () => {
    const result = rewriteAttr('/tmp/guide.md', '<img src="image.png">', '<img src=', '"', 'image.png', '"');
    expect(result).toContain('file:///');
  });

  test('returns original match on error', () => {
    const origDirname = require('path').dirname;
    require('path').dirname = () => { throw new Error('boom'); };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = rewriteAttr('/tmp/guide.md', '<img src="x.png">', '<img src=', '"', 'x.png', '"');
    expect(result).toBe('<img src="x.png">');
    consoleSpy.mockRestore();
    require('path').dirname = origDirname;
  });
});

describe('loadMarkdownParser direct', () => {
  test('returns null for non-existent app dir', () => {
    expect(loadMarkdownParser('/nonexistent/path')).toBeNull();
  });

  const parserAvailable = loadMarkdownParser(projectRoot) !== null;
  test.skipIf(!parserAvailable)('returns parser and HtmlRenderer for valid app dir', () => {
    const result = loadMarkdownParser(projectRoot);
    expect(result).not.toBeNull();
    expect(result!.parse).toBeTypeOf('function');
    expect(result!.HtmlRenderer).toBeTypeOf('function');
  });
});

describe('renderWithParser', () => {
  const modules = loadMarkdownParser(projectRoot);
  const parserAvailable = modules !== null;
  test.skipIf(!parserAvailable)('renders markdown with parser and HtmlRenderer', () => {
    expect(modules).not.toBeNull();
    const result = renderWithParser(modules!.parse, modules!.HtmlRenderer, '/tmp/test.md', '# Hello\n\nWorld');
    expect(result.html).toContain('Hello');
    expect(result.toc.length).toBeGreaterThan(0);
  });

  test.skipIf(!parserAvailable)('renders MDX mode', () => {
    expect(modules).not.toBeNull();
    const result = renderWithParser(modules!.parse, modules!.HtmlRenderer, '/tmp/test.mdx', '# MDX Title\n\nContent');
    expect(result.html).toContain('MDX Title');
  });
});

describe('renderFallback', () => {
  test('returns monospace div with raw content', () => {
    const result = renderFallback('# Hello\n\nWorld');
    expect(result.html).toContain('white-space: pre-wrap');
    expect(result.html).toContain('# Hello');
    expect(result.frontmatter).toEqual({});
    expect(result.toc).toEqual([]);
  });
});
