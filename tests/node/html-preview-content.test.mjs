import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRenderableHtmlContent as uiHasRenderable } from '../../ui/src/markdown/htmlPreviewDocument.ts';
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
