import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHtmlPreviewDocument,
  hasRenderableHtmlContent as uiHasRenderable,
} from '../../ui/src/markdown/htmlPreviewDocument.ts';
import { hasRenderableHtmlContent as vscodeHasRenderable } from '../../vscode/src/markdown/htmlPreviewDocument.ts';

const cases = [
  ['', false],
  ['<style>body { color: red }</style>', false],
  ['<head><script>console.log(1)</script><meta charset="utf-8"></head>', false],
  ['<body><script>console.log(1)</script><style>.x { color: red }</style></body>', false],
  ['<html><head><title>X</title></head><body></body></html>', false],
  ['<!-- only a comment -->', false],
  ['<div></div>', true],
  ['<p>Hello</p>', true],
  ['plain visible text', true],
  ['<svg viewBox="0 0 10 10"></svg>', true],
  ['<my-card></my-card>', true],
];

for (const [source, expected] of cases) {
  test(`classifies ${JSON.stringify(source)}`, () => {
    assert.equal(uiHasRenderable(source), expected);
    assert.equal(vscodeHasRenderable(source), expected);
  });
}

test('inline HTML preview uses observer-driven height updates without polling', () => {
  const html = buildHtmlPreviewDocument('<div>Preview</div>', {
    target: 'inline',
    iframeId: 'preview-1',
  });
  assert.match(html, /ResizeObserver/);
  assert.match(html, /MutationObserver/);
  assert.match(html, /requestAnimationFrame/);
  assert.match(html, /resize-iframe/);
  assert.doesNotMatch(html, /setInterval/);
  assert.doesNotMatch(html, /100\s*\)/);
});

test('non-inline HTML preview does not inject the resize bridge', () => {
  const html = buildHtmlPreviewDocument('<div>Preview</div>', { target: 'modal' });
  assert.doesNotMatch(html, /data-mdn-inline-resize/);
  assert.doesNotMatch(html, /resize-iframe/);
});
