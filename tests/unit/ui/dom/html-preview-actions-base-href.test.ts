import { describe, expect, it, vi } from 'vitest';
import { documentBaseHref, injectBaseHref, openLocalFileInBrowser } from '../../../../ui/src/dom/htmlPreviewActions';

describe('html preview base href helpers', () => {
  it('derives base hrefs from urls and paths', () => {
    expect(documentBaseHref(null)).toBeNull();
    expect(documentBaseHref('https://x.dev/a/b.html')).toBe('https://x.dev/a/');
    expect(documentBaseHref('/docs/a/page.html')).toMatch(/^file:.*\/docs\/a\/$/);
    expect(documentBaseHref('C:\\docs\\page.html')).toMatch(/docs\/$/);
  });

  it('injects base tags into head, html or bare fragments', () => {
    expect(injectBaseHref('<p>x</p>', null)).toBe('<p>x</p>');
    expect(injectBaseHref('<html><head><base href="old"></head></html>', 'file:///d/')).toContain('file:///d/');
    expect(injectBaseHref('<html lang="en"><body>x</body></html>', 'file:///d/')).toMatch(/<html lang="en">\n<head><base/);
    expect(injectBaseHref('<p>x</p>', 'file:///d/')).toMatch(/^<!doctype html><html><head><base/);
  });

  it('opens local files externally', () => {
    const bridge = { postMessage: vi.fn() } as any;
    expect(openLocalFileInBrowser(bridge, '/docs/a.html')).toBe(true);
    expect(bridge.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'openExternal' }));
    expect(openLocalFileInBrowser(bridge, '')).toBe(false);
  });
});
