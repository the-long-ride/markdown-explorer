import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  applyHeadingSectionState,
  captureHeadingSectionState,
} from '../../ui/src/components/Content/enhancements/headingSectionState.ts';
import { enhanceMath } from '../../ui/src/components/Content/enhancements/mathRendering.ts';
import { enhanceSyntax } from '../../ui/src/components/Content/enhancements/syntaxHighlighting.ts';

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  add(value) { this.values.add(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor({ id = '', classes = [], dataset = {}, textContent = '' } = {}) {
    this.id = id;
    this.dataset = { ...dataset };
    this.classList = new FakeClassList(classes);
    this.className = classes.join(' ');
    this.textContent = textContent;
    this.attributes = new Map();
    this.children = [];
  }
  append(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  querySelector(selector) {
    if (selector === '.mdn-section-header') {
      return this.children.find((child) => child.classList.contains('mdn-section-header')) ?? null;
    }
    return null;
  }
}

class FakeRoot {
  constructor(sections = []) { this.sections = sections; this.matches = new Map(); }
  querySelectorAll(selector) {
    if (selector === '.mdn-section') return this.sections;
    return this.matches.get(selector) ?? [];
  }
}

describe('content enhancement idempotence', () => {
  test('syntax highlighting runs once for the same code node', async () => {
    const block = new FakeElement({ classes: ['language-js'] });
    const root = new FakeRoot();
    root.matches.set('pre code:not(.is-custom-highlighted):not([data-mdn-highlighted]):not([data-mdn-render-error])', [block]);
    let calls = 0;
    const getLibrary = async () => ({ highlightElement() { calls += 1; } });

    await enhanceSyntax(root, getLibrary);
    await enhanceSyntax(root, getLibrary);

    assert.equal(calls, 1);
    assert.equal(block.dataset.mdnHighlighted, 'true');
  });

  test('KaTeX renders once for the same math node', async () => {
    const math = new FakeElement({ classes: ['mdn-math', 'mdn-math-block'], dataset: { math: encodeURIComponent('x^2') } });
    const root = new FakeRoot();
    root.matches.set('.mdn-math[data-math]:not(.is-rendered):not([data-mdn-render-error])', [math]);
    let calls = 0;
    const getLibrary = async () => ({ render(tex, element, options) {
      calls += 1;
      assert.equal(tex, 'x^2');
      assert.equal(element, math);
      assert.equal(options.displayMode, true);
    } });

    await enhanceMath(root, getLibrary);
    await enhanceMath(root, getLibrary);

    assert.equal(calls, 1);
    assert.equal(math.classList.contains('is-rendered'), true);
  });

  test('new heading sections respect the configured collapsed default', () => {
    const header = new FakeElement({ classes: ['mdn-section-header'] });
    const section = new FakeElement({ id: 'install', classes: ['mdn-section'], dataset: { expanded: 'true' } });
    section.append(header);

    applyHeadingSectionState(new FakeRoot([section]), new Map(), false);

    assert.equal(section.dataset.expanded, 'false');
    assert.equal(header.getAttribute('aria-expanded'), 'false');
  });

  test('collapsed heading state survives enhancement reruns', () => {
    const header = new FakeElement({ classes: ['mdn-section-header'] });
    const before = new FakeElement({ id: 'install', classes: ['mdn-section'], dataset: { expanded: 'false' } });
    before.append(header);
    const saved = captureHeadingSectionState(new FakeRoot([before]));

    const replacementHeader = new FakeElement({ classes: ['mdn-section-header'] });
    const replacement = new FakeElement({ id: 'install', classes: ['mdn-section'], dataset: { expanded: 'true' } });
    replacement.append(replacementHeader);
    applyHeadingSectionState(new FakeRoot([replacement]), saved, true);

    assert.equal(replacement.dataset.expanded, 'false');
    assert.equal(replacementHeader.getAttribute('aria-expanded'), 'false');
  });
});
