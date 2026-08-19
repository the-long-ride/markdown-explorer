import { beforeEach, describe, expect, it } from 'vitest';
import { applyHtmlPreviewResize } from '../../../../ui/src/dom/globalHandlers';

describe('applyHtmlPreviewResize', () => {
  beforeEach(() => {
    document.body.innerHTML = '<iframe id="preview-frame" style="height:100px"></iframe>';
  });

  it('applies the complete reported preview height without viewport clamping', () => {
    expect(applyHtmlPreviewResize({ type: 'resize-iframe', id: 'preview-frame', height: 2400 })).toBe(true);
    expect((document.getElementById('preview-frame') as HTMLIFrameElement).style.height).toBe('2400px');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '500'])('ignores invalid height %s', (height) => {
    expect(applyHtmlPreviewResize({ type: 'resize-iframe', id: 'preview-frame', height })).toBe(false);
    expect((document.getElementById('preview-frame') as HTMLIFrameElement).style.height).toBe('100px');
  });

  it('ignores missing iframe ids and unrelated messages', () => {
    expect(applyHtmlPreviewResize({ type: 'other', id: 'preview-frame', height: 500 })).toBe(false);
    expect(applyHtmlPreviewResize({ type: 'resize-iframe', id: 'missing', height: 500 })).toBe(false);
  });
});
