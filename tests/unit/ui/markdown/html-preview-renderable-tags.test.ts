import { describe, expect, it } from 'vitest';
import { buildHtmlPreviewDocument, hasRenderableHtmlContent } from '../../../../ui/src/markdown/htmlPreviewDocument';

describe('hasRenderableHtmlContent tag-only content', () => {
  it('treats empty, wrapper-only and closing-only markup as non-renderable', () => {
    expect(hasRenderableHtmlContent(undefined as any)).toBe(false);
    expect(hasRenderableHtmlContent('<!doctype html><html><head><title>t</title></head><body></body></html>')).toBe(false);
    expect(hasRenderableHtmlContent('</p></div>')).toBe(false);
    expect(hasRenderableHtmlContent('<style>')).toBe(false);
  });

  it('treats element-only markup and text as renderable', () => {
    expect(hasRenderableHtmlContent('<div></div>')).toBe(true);
    expect(hasRenderableHtmlContent('<svg:rect width="1"/>')).toBe(true);
    expect(hasRenderableHtmlContent('hello')).toBe(true);
  });

  it('builds a document with the default inline target and no base tag', () => {
    const html = buildHtmlPreviewDocument('<p>x</p>');
    expect(html).toContain('<p>x</p>');
    expect(html).not.toContain('<base ');
  });
});
