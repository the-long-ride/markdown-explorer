import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as rendering from '../../ui/src/components/Content/enhancements/mermaidRendering.ts';
import * as theme from '../../ui/src/components/Content/enhancements/mermaidTheme.ts';

function fakeStyle(initial = {}) {
  return {
    ...initial,
    setProperty(name, value) { this[name] = value; },
  };
}

function fakeSvg() {
  const attrs = new Map();
  const paths = [
    {
      attrs: new Map([['fill', '#ff0000'], ['stroke', '#00ff00']]),
      setAttribute(name, value) { this.attrs.set(name, value); },
      getAttribute(name) { return this.attrs.get(name) ?? null; },
    },
  ];
  return {
    style: fakeStyle(),
    attrs,
    paths,
    setAttribute(name, value) { attrs.set(name, value); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    querySelector(selector) {
      if (selector === 'g') return { getBBox: () => ({ x: 0, y: 0, width: 240, height: 120 }) };
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes('path') || selector.includes('line') || selector.includes('polyline')) return paths;
      return [];
    },
  };
}

test('Mermaid invalidation restores source and clears render state', () => {
  assert.equal(typeof rendering.invalidateMermaidRenderings, 'function');
  const node = {
    dataset: {
      originalCode: 'flowchart LR\nA-->B',
      mdnRendered: 'true',
      mdnRenderError: 'true',
      mdnRenderAttempts: '2',
    },
    textContent: '<svg>old</svg>',
    removed: [],
    removeAttribute(name) { this.removed.push(name); },
  };
  const root = { querySelectorAll: () => [node] };
  rendering.invalidateMermaidRenderings(root);
  assert.equal(node.textContent, 'flowchart LR\nA-->B');
  assert.equal(node.dataset.mdnRendered, undefined);
  assert.equal(node.dataset.mdnRenderError, undefined);
  assert.equal(node.dataset.mdnRenderAttempts, undefined);
  assert.deepEqual(node.removed, ['data-processed']);
});

test('Mermaid SVG polish keeps authored colors while improving vector strokes', () => {
  assert.equal(typeof rendering.polishMermaidSvg, 'function');
  const svg = fakeSvg();
  rendering.polishMermaidSvg(svg);
  assert.equal(svg.getAttribute('shape-rendering'), 'geometricPrecision');
  assert.equal(svg.getAttribute('text-rendering'), 'geometricPrecision');
  assert.equal(svg.paths[0].getAttribute('fill'), '#ff0000');
  assert.equal(svg.paths[0].getAttribute('stroke'), '#00ff00');
  assert.equal(svg.paths[0].getAttribute('vector-effect'), 'non-scaling-stroke');
  assert.equal(svg.paths[0].getAttribute('stroke-linecap'), 'round');
  assert.equal(svg.paths[0].getAttribute('stroke-linejoin'), 'round');
});

test('Mermaid renderer initializes from theme, Mermaid font, and diagram profile', async () => {
  const initialized = [];
  const svg = fakeSvg();
  const wrapper = { dataset: {} };
  const node = {
    dataset: {},
    textContent: 'flowchart LR\nA-->B',
    svg: null,
    querySelector(selector) { return selector === 'svg' ? this.svg : null; },
    querySelectorAll(selector) { return selector === 'svg' && this.svg ? [this.svg] : []; },
    removeAttribute() {},
    closest() { return wrapper; },
  };
  const root = {
    querySelectorAll() { return node.dataset.mdnRendered ? [] : [node]; },
  };
  const doc = {
    documentElement: {},
    defaultView: {
      getComputedStyle() {
        return {
          getPropertyValue(name) {
            const values = {
              '--bg': '#111111', '--bg-s': '#1b1b1b', '--tx': '#f8f8f8', '--tx2': '#aaaaaa',
              '--bd-s': '#444444', '--accent': '#7c3aed', '--success': '#22c55e', '--danger': '#ef4444',
              '--chart-1': '#7c3aed', '--chart-2': '#14b8a6', '--chart-3': '#f59e0b', '--chart-4': '#3b82f6',
              '--font-mermaid': '"Inter", sans-serif',
            };
            return values[name] ?? '';
          },
        };
      },
    },
  };
  const mermaid = {
    initialize(options) { initialized.push(options); },
    async run() { node.svg = svg; },
  };
  await rendering.enhanceMermaid(root, {
    getLibrary: async () => mermaid,
    isDark: true,
    isCancelled: () => false,
    runIdRef: { current: 0 },
    document: doc,
  });

  assert.equal(initialized.length, 1);
  assert.equal(initialized[0].theme, 'base');
  assert.equal(initialized[0].fontFamily, '"Inter", sans-serif');
  assert.equal(initialized[0].themeVariables.primaryColor, '#1b1b1b');
  assert.equal(initialized[0].flowchart.nodeSpacing, 36);
  assert.equal(wrapper.dataset.mdnMermaidKind, 'flowchart');
  assert.equal(node.dataset.mdnRendered, 'true');
  assert.equal(svg.getAttribute('preserveAspectRatio'), 'xMidYMid meet');
});

test('stale Mermaid runs do not mark an old-theme SVG as rendered', async () => {
  const svg = fakeSvg();
  const runIdRef = { current: 0 };
  const node = {
    dataset: {},
    textContent: 'sequenceDiagram\nA->>B: hi',
    svg: null,
    querySelector(selector) { return selector === 'svg' ? this.svg : null; },
    querySelectorAll(selector) { return selector === 'svg' && this.svg ? [this.svg] : []; },
    removeAttribute() {},
    closest() { return { dataset: {} }; },
  };
  const root = { querySelectorAll: () => node.dataset.mdnRendered ? [] : [node] };
  const mermaid = {
    initialize() {},
    async run() {
      node.svg = svg;
      node.textContent = '<svg>stale theme</svg>';
      runIdRef.current += 1;
    },
  };
  await rendering.enhanceMermaid(root, {
    getLibrary: async () => mermaid,
    isDark: false,
    isCancelled: () => false,
    runIdRef,
    document: { documentElement: {}, defaultView: { getComputedStyle: () => ({ getPropertyValue: () => '' }) } },
  });
  assert.notEqual(node.dataset.mdnRendered, 'true');
  assert.equal(node.textContent, 'sequenceDiagram\nA->>B: hi');
});

test('Gantt intrinsic sizing preserves a wide SVG and horizontal scrolling', () => {
  assert.equal(typeof rendering.applyGanttIntrinsicWidth, 'function');
  const svg = fakeSvg();
  svg.setAttribute('width', '760');
  svg.style.maxWidth = '100%';
  const wrapper = { style: fakeStyle() };
  const source = `gantt
    dateFormat YYYY-MM-DD
    section Delivery
    Production rollout and rollback observation window :2026-05-18, 14d
    Security approval and customer acceptance validation :2026-06-10, 10d`;

  const width = rendering.applyGanttIntrinsicWidth(svg, wrapper, source);
  assert.ok(width >= 920);
  assert.equal(svg.style.width, `${width}px`);
  assert.equal(svg.style.minWidth, `${width}px`);
  assert.equal(svg.style.maxWidth, 'none');
  assert.equal(svg.style.marginInline, '0');
  assert.equal(wrapper.style.overflowX, 'auto');
});

function fakeColorElement({ fill = null, color = null, background = null, tagName = 'text' } = {}) {
  const attrs = new Map();
  if (fill !== null) attrs.set('fill', fill);
  const style = fakeStyle();
  if (color !== null) style.color = color;
  if (background !== null) style.backgroundColor = background;
  return {
    tagName,
    attrs,
    style,
    parentElement: null,
    setAttribute(name, value) { attrs.set(name, value); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    querySelector() { return null; },
  };
}

function fakeContrastSvg(texts) {
  return {
    querySelectorAll(selector) {
      if (selector.includes('text') || selector.includes('tspan') || selector.includes('foreignObject')) return texts;
      return [];
    },
  };
}

const contrastTokens = {
  background: '#ffffff',
  surface: '#f5f5f5',
  text: '#111827',
  mutedText: '#667085',
  border: '#c7cbd1',
  accent: '#7c3aed',
  success: '#16a34a',
  danger: '#dc2626',
  chart1: '#7c3aed',
  chart2: '#0f9f8f',
  chart3: '#d97706',
  chart4: '#2563eb',
};

test('Mermaid SVG contrast pass uses the strongest neutral foreground for local backgrounds', () => {
  assert.equal(typeof rendering.enforceMermaidSvgContrast, 'function');
  const darkShape = fakeColorElement({ fill: '#111827' });
  const group = {
    parentElement: null,
    getAttribute() { return null; },
    querySelector(selector) { return /rect|path|polygon|circle|ellipse/.test(selector) ? darkShape : null; },
  };
  const unreadable = fakeColorElement({ fill: '#111827' });
  const readable = fakeColorElement({ fill: '#f9fafb' });
  unreadable.parentElement = group;
  readable.parentElement = group;
  const svg = fakeContrastSvg([unreadable, readable]);

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);
  assert.equal(unreadable.getAttribute('fill'), '#ffffff');
  assert.equal(readable.getAttribute('fill'), '#ffffff');

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);
  assert.equal(unreadable.getAttribute('fill'), '#ffffff');
  assert.equal(readable.getAttribute('fill'), '#ffffff');
});

test('C4 post-render fallback binds selected Mermaid font to text, tspan, and foreignObject text', () => {
  assert.equal(typeof rendering.enforceC4Font, 'function');
  const text = fakeColorElement();
  const tspan = fakeColorElement();
  const html = fakeColorElement();
  const svg = {
    querySelectorAll(selector) {
      return selector === 'text, tspan, foreignObject *' ? [text, tspan, html] : [];
    },
  };
  rendering.enforceC4Font(svg, '"JetBrains Mono", monospace');
  for (const element of [text, tspan, html]) {
    assert.equal(element.style.fontFamily, '"JetBrains Mono", monospace');
  }
});

test('C4 Mermaid initialization binds custom font to all shape and relationship font fields', async () => {
  const initialized = [];
  const svg = fakeSvg();
  const node = {
    dataset: {},
    textContent: 'C4Context\ntitle Platform\nPerson(user, "User")\nSystem(app, "App")\nRel(user, app, "Uses")',
    svg: null,
    querySelector(selector) { return selector === 'svg' ? this.svg : null; },
    querySelectorAll(selector) { return selector === 'svg' && this.svg ? [this.svg] : []; },
    removeAttribute() {},
    closest() { return { dataset: {}, style: fakeStyle() }; },
  };
  const root = { querySelectorAll: () => node.dataset.mdnRendered ? [] : [node] };
  const doc = {
    documentElement: {},
    defaultView: {
      getComputedStyle() {
        return { getPropertyValue(name) { return name === '--font-mermaid' ? '"JetBrains Mono", monospace' : ''; } };
      },
    },
  };
  const mermaid = {
    initialize(options) { initialized.push(options); },
    async run() { node.svg = svg; },
  };

  await rendering.enhanceMermaid(root, {
    getLibrary: async () => mermaid,
    isDark: false,
    isCancelled: () => false,
    runIdRef: { current: 0 },
    document: doc,
  });

  const c4 = initialized[0].c4;
  for (const field of [
    'personFontFamily', 'external_personFontFamily', 'systemFontFamily', 'external_systemFontFamily',
    'system_dbFontFamily', 'external_system_dbFontFamily', 'system_queueFontFamily', 'external_system_queueFontFamily',
    'boundaryFontFamily', 'messageFontFamily', 'containerFontFamily', 'external_containerFontFamily',
    'container_dbFontFamily', 'external_container_dbFontFamily', 'container_queueFontFamily', 'external_container_queueFontFamily',
    'componentFontFamily', 'external_componentFontFamily', 'component_dbFontFamily', 'external_component_dbFontFamily',
    'component_queueFontFamily', 'external_component_queueFontFamily',
  ]) {
    assert.equal(c4[field], '"JetBrains Mono", monospace', field);
  }
});

function fakeArchitectureElement(box, attributes = {}) {
  const attrs = new Map(Object.entries(attributes));
  return {
    attrs,
    style: fakeStyle(),
    getBBox() { return { ...box }; },
    getAttribute(name) { return attrs.get(name) ?? null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
  };
}

function fakeArchitectureService(shapeBox, labelBox, labelAttributes = {}) {
  const shape = fakeArchitectureElement(shapeBox);
  const label = fakeArchitectureElement(labelBox, labelAttributes);
  const service = {
    querySelector(selector) {
      if (/rect|circle|ellipse|polygon/.test(selector)) return shape;
      return null;
    },
    querySelectorAll(selector) {
      if (/text|foreignObject/.test(selector)) return [label];
      return [];
    },
  };
  return { service, shape, label };
}

test('Architecture collision repair preserves native layout and applies label styling idempotently', () => {
  assert.equal(typeof rendering.repairArchitectureLabelCollisions, 'function');
  const serviceItem = fakeArchitectureService(
    { x: 20, y: 10, width: 80, height: 60 },
    { x: 30, y: 62, width: 60, height: 18 },
    { transform: 'rotate(0)' },
  );
  const svg = {
    querySelectorAll(selector) {
      return selector.includes('g') ? [serviceItem.service] : [];
    },
  };

  const moved = rendering.repairArchitectureLabelCollisions(svg);
  assert.equal(moved, 0);
  assert.equal(serviceItem.label.style.fontFamily, 'var(--font-mermaid)');
  assert.equal(serviceItem.label.style.paintOrder, 'stroke fill');
  assert.equal(serviceItem.label.getAttribute('transform'), 'rotate(0)');

  assert.equal(rendering.repairArchitectureLabelCollisions(svg), 0);
  assert.equal(serviceItem.label.getAttribute('transform'), 'rotate(0)');
});

test('Gantt adaptive width is passed to Mermaid before layout, not only applied after render', async () => {
  const initialized = [];
  const svg = fakeSvg();
  const wrapper = { dataset: {}, style: fakeStyle() };
  const source = `gantt
    title Cross-region delivery programme
    dateFormat YYYY-MM-DD
    section Product discovery and validation
    Stakeholder acceptance and product readiness review :done, 2026-01-03, 18d
    section Regional integration
    Multi-region integration and regression verification :active, 2026-03-10, 24d
    section Delivery
    Production rollout and rollback observation window :2026-07-20, 14d`;
  const node = {
    dataset: {}, textContent: source, svg: null,
    querySelector(selector) { return selector === 'svg' ? this.svg : null; },
    querySelectorAll(selector) { return selector === 'svg' && this.svg ? [this.svg] : []; },
    removeAttribute() {}, closest() { return wrapper; },
  };
  const root = { querySelectorAll: () => node.dataset.mdnRendered ? [] : [node] };
  const mermaid = {
    initialize(options) { initialized.push(options); },
    async run() { node.svg = svg; },
  };

  await rendering.enhanceMermaid(root, {
    getLibrary: async () => mermaid,
    isDark: false,
    isCancelled: () => false,
    runIdRef: { current: 0 },
    document: { documentElement: {}, defaultView: { getComputedStyle: () => ({ getPropertyValue: () => '' }) } },
  });

  assert.equal(initialized.length, 1);
  assert.ok(initialized[0].gantt.useWidth >= 920, 'Mermaid must receive the wide layout width before rendering');
  assert.equal(initialized[0].gantt.useWidth, Number.parseInt(svg.style.width, 10));
});

test('Mermaid contrast lookup does not borrow fill from an unrelated descendant shape', () => {
  const unrelatedShape = fakeColorElement({ fill: '#111827' });
  const rootGroup = {
    parentElement: null,
    getAttribute() { return null; },
    querySelector(selector) {
      if (selector.includes(':scope >')) return null;
      return /rect|path|polygon|circle|ellipse/.test(selector) ? unrelatedShape : null;
    },
  };
  const title = fakeColorElement({ fill: '#111827' });
  title.parentElement = rootGroup;
  const svg = fakeContrastSvg([title]);

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);
  assert.equal(title.getAttribute('fill'), '#111111', 'diagram title should use the diagram background, not an unrelated node fill');
});

test('Architecture collision repair targets actual service labels and path backgrounds only', () => {
  const pathShape = fakeArchitectureElement({ x: 20, y: 10, width: 80, height: 60 });
  const serviceLabel = fakeArchitectureElement(
    { x: 28, y: 58, width: 64, height: 18 },
    { class: 'architecture-service-label', transform: 'translate(40 60)' },
  );
  const groupTitle = fakeArchitectureElement(
    { x: 12, y: 12, width: 70, height: 18 },
    { class: 'architecture-group-label' },
  );
  const service = {
    querySelector(selector) {
      if (selector.includes('node-bkg') || selector.includes('path')) return pathShape;
      if (selector.includes('architecture-service-label')) return serviceLabel;
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes('architecture-service-label')) return [serviceLabel];
      if (selector.includes('text')) return [serviceLabel];
      return [];
    },
  };
  const topLevelArchitectureGroup = {
    querySelector(selector) { return selector.includes('path') ? pathShape : null; },
    querySelectorAll(selector) { return selector.includes('text') ? [groupTitle, serviceLabel] : []; },
  };
  const svg = {
    querySelectorAll(selector) {
      if (selector === 'g.architecture-service') return [service];
      if (selector.includes('g[class*="architecture"]')) return [topLevelArchitectureGroup, service];
      return [];
    },
  };

  const moved = rendering.repairArchitectureLabelCollisions(svg);
  assert.equal(moved, 0);
  assert.equal(serviceLabel.style.fontFamily, 'var(--font-mermaid)');
  assert.equal(serviceLabel.getAttribute('transform'), 'translate(40 60)');
});

function affineMatrix(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
  return {
    a, b, c, d, e, f,
    inverse() {
      const determinant = this.a * this.d - this.b * this.c;
      return affineMatrix(
        this.d / determinant,
        -this.b / determinant,
        -this.c / determinant,
        this.a / determinant,
        (this.c * this.f - this.d * this.e) / determinant,
        (this.b * this.e - this.a * this.f) / determinant,
      );
    },
    multiply(other) {
      return affineMatrix(
        this.a * other.a + this.c * other.b,
        this.b * other.a + this.d * other.b,
        this.a * other.c + this.c * other.d,
        this.b * other.c + this.d * other.d,
        this.a * other.e + this.c * other.f + this.e,
        this.b * other.e + this.d * other.f + this.f,
      );
    },
  };
}

function identityMatrix() {
  return affineMatrix();
}

function layeredStyle(initial = {}) {
  const style = fakeStyle(initial);
  style.getPropertyValue = (name) => style[name] ?? '';
  return style;
}

function fakeLayerElement(tagName, box, fill = null) {
  const attrs = new Map();
  if (fill !== null) attrs.set('fill', fill);
  const element = {
    tagName,
    attrs,
    style: layeredStyle(),
    children: [],
    parentElement: null,
    ownerDocument: null,
    box,
    getBBox() { return { ...this.box }; },
    getCTM() { return identityMatrix(); },
    getAttribute(name) { return this.attrs.get(name) ?? null; },
    setAttribute(name, value) { this.attrs.set(name, String(value)); },
    removeAttribute(name) { this.attrs.delete(name); },
    appendChild(child) { child.parentElement = this; child.ownerDocument = this.ownerDocument; this.children.push(child); return child; },
    insertBefore(child, reference) {
      child.parentElement = this;
      child.ownerDocument = this.ownerDocument;
      const index = reference ? this.children.indexOf(reference) : -1;
      if (index >= 0) this.children.splice(index, 0, child);
      else this.children.push(child);
      return child;
    },
    remove() {
      const index = this.parentElement?.children.indexOf(this) ?? -1;
      if (index >= 0) this.parentElement.children.splice(index, 1);
      this.parentElement = null;
    },
    cloneNode(deep = false) {
      const clone = fakeLayerElement(this.tagName, this.box, this.getAttribute('fill'));
      clone.ownerDocument = this.ownerDocument;
      for (const [key, value] of this.attrs) clone.attrs.set(key, value);
      Object.assign(clone.style, this.style);
      if (deep) this.children.forEach((child) => clone.appendChild(child.cloneNode(true)));
      return clone;
    },
    contains(candidate) {
      if (candidate === this) return true;
      return this.children.some((child) => child.contains(candidate));
    },
    closest(selector) {
      const blocked = /defs|clipPath|mask|marker/.test(selector);
      if (!blocked) return null;
      let current = this.parentElement;
      while (current) {
        if (/^(defs|clipPath|mask|marker)$/i.test(current.tagName)) return current;
        current = current.parentElement;
      }
      return null;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector) {
      const descendants = [];
      const walk = (node) => {
        for (const child of node.children) { descendants.push(child); walk(child); }
      };
      walk(this);
      if (selector === '*') return descendants;
      if (selector === '[id]') return descendants.filter((child) => child.getAttribute('id'));
      if (selector.includes('text') || selector.includes('foreignObject')) {
        return descendants.filter((child) => ['text', 'foreignObject', 'tspan', 'div', 'span'].includes(child.tagName));
      }
      if (/rect|path|polygon|circle|ellipse/.test(selector)) {
        return descendants.filter((child) => /^(rect|path|polygon|circle|ellipse)$/i.test(child.tagName));
      }
      if (selector.includes('data-mdn-mermaid-contrast-layer')) {
        return descendants.filter((child) => child.getAttribute('data-mdn-mermaid-contrast-layer') === 'true');
      }
      if (selector.includes('data-mdn-mermaid-contrast-defs')) {
        return descendants.filter((child) => child.getAttribute('data-mdn-mermaid-contrast-defs') === 'true');
      }
      return [];
    },
  };
  Object.defineProperty(element, 'nextSibling', {
    get() {
      const siblings = this.parentElement?.children ?? [];
      const index = siblings.indexOf(this);
      return index >= 0 ? (siblings[index + 1] ?? null) : null;
    },
  });
  return element;
}

function regionAwareSvg({ labelBox, shapes }) {
  const svg = fakeLayerElement('svg', { x: 0, y: 0, width: 300, height: 100 });
  const doc = {
    defaultView: { getComputedStyle: (element) => ({
      getPropertyValue(name) {
        if (name === 'fill') return element.getAttribute?.('fill') ?? '';
        if (name === 'color') return element.style?.color ?? '';
        if (name === 'background-color') return element.style?.backgroundColor ?? '';
        if (name === 'font-size') return '16px';
        if (name === 'font-weight') return '400';
        return '';
      },
    }) },
    createElementNS(_ns, tagName) {
      const element = fakeLayerElement(tagName, { x: 0, y: 0, width: 0, height: 0 });
      element.ownerDocument = doc;
      return element;
    },
  };
  svg.ownerDocument = doc;
  const label = fakeLayerElement('text', labelBox);
  label.ownerDocument = doc;
  label.setAttribute('id', 'visible-label');
  svg.appendChild(label);
  for (const shape of shapes) {
    shape.ownerDocument = doc;
    svg.insertBefore(shape, label);
  }
  return { svg, label };
}

test('neutral Mermaid foreground always chooses the strongest neutral contrast', () => {
  assert.equal(typeof rendering.chooseNeutralMermaidForeground, 'function');
  assert.equal(rendering.chooseNeutralMermaidForeground('#111111', contrastTokens), '#ffffff');
  assert.equal(rendering.chooseNeutralMermaidForeground('#fefefe', contrastTokens), '#111111');
  const semanticTokens = { ...contrastTokens, text: '#7c3aed', background: '#16a34a' };
  const selected = rendering.chooseNeutralMermaidForeground('#ffffff', semanticTokens);
  assert.ok(['#111111', '#ffffff'].includes(selected), `expected fixed neutral, got ${selected}`);
  assert.notEqual(selected, semanticTokens.text);
  assert.notEqual(selected, semanticTokens.background);
});

test('region-aware Mermaid contrast splits one label across two painted backgrounds', () => {
  const red = fakeLayerElement('rect', { x: 0, y: 0, width: 120, height: 60 }, '#ef233c');
  const dark = fakeLayerElement('rect', { x: 120, y: 0, width: 120, height: 60 }, '#111111');
  const { svg, label } = regionAwareSvg({ labelBox: { x: 60, y: 10, width: 140, height: 30 }, shapes: [red, dark] });

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);

  const layers = svg.querySelectorAll('[data-mdn-mermaid-contrast-layer="true"]');
  assert.equal(layers.length, 2, 'one clipped visual text layer is required per intersecting painted region');
  assert.equal(label.getAttribute('fill'), '#111111', 'base/canvas text uses the strongest neutral for the page background');
  assert.equal(layers[0].getAttribute('fill'), '#111111', 'red region receives dark neutral text');
  assert.equal(layers[1].getAttribute('fill'), '#ffffff', 'dark region receives light neutral text');
  assert.equal(layers[0].getAttribute('aria-hidden'), 'true');
  assert.equal(layers[0].getAttribute('id'), null, 'visual clones must not duplicate source IDs');
});

test('region-aware Mermaid contrast handles three regions and rebuilds layers idempotently', () => {
  const light = fakeLayerElement('rect', { x: 0, y: 0, width: 80, height: 60 }, '#ffffff');
  const medium = fakeLayerElement('rect', { x: 80, y: 0, width: 80, height: 60 }, '#f43f5e');
  const dark = fakeLayerElement('rect', { x: 160, y: 0, width: 80, height: 60 }, '#101010');
  const { svg } = regionAwareSvg({ labelBox: { x: 20, y: 10, width: 200, height: 30 }, shapes: [light, medium, dark] });

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);
  assert.equal(svg.querySelectorAll('[data-mdn-mermaid-contrast-layer="true"]').length, 3);
  rendering.enforceMermaidSvgContrast(svg, contrastTokens);
  assert.equal(svg.querySelectorAll('[data-mdn-mermaid-contrast-layer="true"]').length, 3, 'second pass rebuilds instead of multiplying layers');
});

test('foreignObject with an opaque HTML background uses one local neutral foreground', () => {
  const { svg } = regionAwareSvg({ labelBox: { x: 20, y: 10, width: 140, height: 30 }, shapes: [] });
  const foreignObject = fakeLayerElement('foreignObject', { x: 20, y: 10, width: 140, height: 30 });
  foreignObject.ownerDocument = svg.ownerDocument;
  const div = fakeLayerElement('div', { x: 20, y: 10, width: 140, height: 30 });
  div.ownerDocument = svg.ownerDocument;
  div.style.backgroundColor = '#111111';
  div.setAttribute('id', 'html-label');
  foreignObject.appendChild(div);
  svg.appendChild(foreignObject);

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);

  assert.equal(div.style.color, '#ffffff');
  assert.equal(svg.querySelectorAll('[data-mdn-mermaid-contrast-layer="true"]').length, 0, 'opaque HTML background needs no SVG region clones');
});

test('transparent foreignObject receives clipped neutral layers for SVG backgrounds', () => {
  const red = fakeLayerElement('rect', { x: 0, y: 0, width: 100, height: 60 }, '#ef233c');
  const dark = fakeLayerElement('rect', { x: 100, y: 0, width: 100, height: 60 }, '#111111');
  const { svg } = regionAwareSvg({ labelBox: { x: 240, y: 10, width: 20, height: 20 }, shapes: [red, dark] });
  const foreignObject = fakeLayerElement('foreignObject', { x: 40, y: 10, width: 120, height: 30 });
  foreignObject.ownerDocument = svg.ownerDocument;
  const div = fakeLayerElement('div', { x: 40, y: 10, width: 120, height: 30 });
  div.ownerDocument = svg.ownerDocument;
  div.setAttribute('id', 'transparent-html-label');
  foreignObject.appendChild(div);
  svg.appendChild(foreignObject);

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);

  const layers = svg.querySelectorAll('[data-mdn-mermaid-contrast-layer="true"]');
  assert.equal(layers.length, 2);
  assert.equal(layers[0].tagName, 'foreignObject');
  assert.equal(layers[0].getAttribute('aria-hidden'), 'true');
  assert.equal(layers[0].querySelectorAll('[id]').length, 0, 'cloned HTML descendants must not duplicate IDs');
});

test('neutral Mermaid foreground composites translucent fills over the active diagram background', () => {
  const darkTokens = { ...contrastTokens, background: '#000000', text: '#f8fafc' };
  assert.equal(
    rendering.chooseNeutralMermaidForeground('rgba(255, 255, 255, 0.2)', darkTokens),
    '#ffffff',
    '20% white over a black diagram is still dark and needs light text',
  );
});

test('region-aware contrast falls back safely when cross-group CTM geometry is unavailable', () => {
  const svg = fakeLayerElement('svg', { x: 0, y: 0, width: 300, height: 100 });
  const doc = {
    defaultView: { getComputedStyle: (element) => ({
      getPropertyValue(name) {
        if (name === 'fill') return element.getAttribute?.('fill') ?? '';
        if (name === 'background-color') return '';
        return '';
      },
    }) },
    createElementNS(_ns, tagName) {
      const element = fakeLayerElement(tagName, { x: 0, y: 0, width: 0, height: 0 });
      element.ownerDocument = doc;
      return element;
    },
  };
  svg.ownerDocument = doc;
  const shapeGroup = fakeLayerElement('g', { x: 0, y: 0, width: 0, height: 0 });
  const labelGroup = fakeLayerElement('g', { x: 0, y: 0, width: 0, height: 0 });
  shapeGroup.ownerDocument = doc;
  labelGroup.ownerDocument = doc;
  shapeGroup.getCTM = () => null;
  labelGroup.getCTM = () => null;
  const shape = fakeLayerElement('rect', { x: 0, y: 0, width: 180, height: 60 }, '#111111');
  shape.ownerDocument = doc;
  shape.getCTM = () => null;
  const label = fakeLayerElement('text', { x: 20, y: 10, width: 120, height: 30 });
  label.ownerDocument = doc;
  label.getCTM = () => null;
  shapeGroup.appendChild(shape);
  labelGroup.appendChild(label);
  svg.appendChild(shapeGroup);
  svg.appendChild(labelGroup);

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);

  assert.equal(svg.querySelectorAll('[data-mdn-mermaid-contrast-layer="true"]').length, 0, 'unsafe cross-group geometry must not emit a clip layer');
  assert.equal(label.getAttribute('fill'), '#111111', 'unsafe cross-group geometry falls back to the diagram canvas foreground');
  assert.equal(shape.getAttribute('fill'), '#111111', 'authored background fill must remain untouched');
});

test('foreignObject contrast preserves embedded icon fills and respects nested local backgrounds', () => {
  const { svg } = regionAwareSvg({ labelBox: { x: 240, y: 10, width: 20, height: 20 }, shapes: [] });
  const foreignObject = fakeLayerElement('foreignObject', { x: 20, y: 10, width: 140, height: 30 });
  foreignObject.ownerDocument = svg.ownerDocument;
  const container = fakeLayerElement('div', { x: 20, y: 10, width: 140, height: 30 });
  container.ownerDocument = svg.ownerDocument;
  container.style.backgroundColor = '#ffffff';
  const nested = fakeLayerElement('span', { x: 40, y: 10, width: 50, height: 20 });
  nested.ownerDocument = svg.ownerDocument;
  nested.style.backgroundColor = '#111111';
  const icon = fakeLayerElement('path', { x: 24, y: 14, width: 12, height: 12 }, '#ef4444');
  icon.ownerDocument = svg.ownerDocument;
  container.appendChild(nested);
  container.appendChild(icon);
  foreignObject.appendChild(container);
  svg.appendChild(foreignObject);

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);

  assert.equal(container.style.color, '#111111', 'outer white HTML surface gets dark text');
  assert.equal(nested.style.color, '#ffffff', 'nested dark highlight gets its own light text');
  assert.equal(icon.getAttribute('fill'), '#ef4444', 'contrast repair must not recolor embedded icon geometry');
});

test('region contrast clones stay immediately after the source label in local paint order', () => {
  const dark = fakeLayerElement('rect', { x: 0, y: 0, width: 180, height: 60 }, '#111111');
  const { svg, label } = regionAwareSvg({ labelBox: { x: 20, y: 10, width: 120, height: 30 }, shapes: [dark] });
  const laterGraphic = fakeLayerElement('line', { x: 0, y: 0, width: 200, height: 60 });
  laterGraphic.ownerDocument = svg.ownerDocument;
  svg.appendChild(laterGraphic);

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);

  const layer = svg.querySelectorAll('[data-mdn-mermaid-contrast-layer="true"]')[0];
  assert.ok(layer, 'expected a contrast clone');
  assert.ok(svg.children.indexOf(label) < svg.children.indexOf(layer));
  assert.ok(svg.children.indexOf(layer) < svg.children.indexOf(laterGraphic), 'clone must not jump above later unrelated graphics');
});


test('region clip geometry is expressed in a transformed label current user coordinate system', () => {
  const shape = fakeLayerElement('rect', { x: 0, y: 0, width: 180, height: 60 }, '#111111');
  const { svg, label } = regionAwareSvg({ labelBox: { x: 20, y: 10, width: 120, height: 30 }, shapes: [shape] });
  shape.getCTM = () => affineMatrix();
  label.getCTM = () => affineMatrix(1, 0, 0, 1, 50, 0);

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);

  const defs = svg.children.find((child) => child.tagName === 'defs');
  const clipPath = defs?.children.find((child) => child.tagName === 'clipPath');
  const geometry = clipPath?.children[0];
  assert.ok(geometry, 'expected clip geometry for the intersecting background');
  assert.equal(
    geometry.getAttribute('transform'),
    'matrix(1 0 0 1 -50 0)',
    'clip geometry must be transformed from shape space into the label current user coordinate system',
  );
});

test('region contrast skips raw same-parent clipping when transformed geometry has no CTM', () => {
  const shape = fakeLayerElement('rect', { x: 0, y: 0, width: 180, height: 60 }, '#111111');
  const { svg, label } = regionAwareSvg({ labelBox: { x: 20, y: 10, width: 120, height: 30 }, shapes: [shape] });
  shape.setAttribute('transform', 'translate(20 0)');
  label.setAttribute('transform', 'translate(50 0)');
  shape.getCTM = () => null;
  label.getCTM = () => null;

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);

  assert.equal(
    svg.querySelectorAll('[data-mdn-mermaid-contrast-layer="true"]').length,
    0,
    'transformed geometry without CTM must use the safe single-color fallback',
  );
  assert.equal(label.getAttribute('fill'), '#111111');
});


test('contrast fallback prefers a painted child shape over an inherited group fill', () => {
  const svg = fakeLayerElement('svg', { x: 0, y: 0, width: 200, height: 100 });
  const doc = {
    defaultView: { getComputedStyle: (element) => ({
      getPropertyValue(name) {
        if (name === 'fill') return element.style?.fill || element.getAttribute?.('fill') || '';
        if (name === 'background-color') return element.style?.backgroundColor || '';
        return '';
      },
    }) },
    createElementNS(_ns, tagName) {
      const element = fakeLayerElement(tagName, { x: 0, y: 0, width: 0, height: 0 });
      element.ownerDocument = doc;
      return element;
    },
  };
  svg.ownerDocument = doc;
  const group = fakeLayerElement('g', { x: 0, y: 0, width: 0, height: 0 });
  group.ownerDocument = doc;
  group.style.fill = '#111111';
  const visibleShape = fakeLayerElement('rect', { x: 0, y: 0, width: 180, height: 60 }, '#ffffff');
  visibleShape.ownerDocument = doc;
  const label = fakeLayerElement('text', { x: 20, y: 10, width: 120, height: 30 });
  label.ownerDocument = doc;
  label.getBBox = () => { throw new Error('measurement unavailable'); };
  group.appendChild(visibleShape);
  group.appendChild(label);
  svg.appendChild(group);

  rendering.enforceMermaidSvgContrast(svg, contrastTokens);

  assert.equal(label.getAttribute('fill'), '#111111', 'white painted node background needs dark neutral text');
});

test('ZenUML uses safe single-color contrast without region clone layers', () => {
  const dark = fakeLayerElement('rect', { x: 0, y: 0, width: 100, height: 60 }, '#111111');
  const light = fakeLayerElement('rect', { x: 100, y: 0, width: 100, height: 60 }, '#ffffff');
  const { svg, label } = regionAwareSvg({ labelBox: { x: 40, y: 10, width: 120, height: 30 }, shapes: [dark, light] });

  rendering.enforceMermaidSvgContrast(svg, contrastTokens, { regionAware: false });

  assert.equal(svg.querySelectorAll('[data-mdn-mermaid-contrast-layer="true"]').length, 0);
  assert.ok(['#111111', '#ffffff'].includes(label.getAttribute('fill')));
});

test('Architecture repair centers a service label below the full service geometry', () => {
  const left = fakeArchitectureElement({ x: 20, y: 10, width: 35, height: 60 });
  const right = fakeArchitectureElement({ x: 55, y: 10, width: 45, height: 60 });
  const label = fakeArchitectureElement(
    { x: 58, y: 62, width: 50, height: 18 },
    { class: 'architecture-service-label' },
  );
  const service = {
    querySelector(selector) {
      if (selector.includes('architecture-service-label')) return label;
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes('architecture-service-label') || selector.includes('text')) return [label];
      if (/rect|circle|ellipse|polygon|path/.test(selector)) return [left, right];
      return [];
    },
  };
  const svg = { querySelectorAll(selector) { return selector === 'g.architecture-service' ? [service] : []; } };

  const moved = rendering.repairArchitectureLabelCollisions(svg);
  assert.equal(moved, 0);
  assert.equal(label.style.fontFamily, 'var(--font-mermaid)');
});

test('Gantt body view keeps its scroll viewport inside the markdown body', () => {
  const svg = fakeSvg();
  svg.setAttribute('width', '760');
  const wrapper = {
    clientWidth: 1000,
    style: fakeStyle(),
    closest() { return null; },
  };
  const source = `gantt
    dateFormat YYYY-MM-DD
    section Long delivery
    Product discovery and stakeholder alignment :2026-01-01, 20d
    Architecture constraints and dependency planning :2026-02-01, 20d
    Production rollout and observation :2026-06-01, 20d`;

  const width = rendering.applyGanttIntrinsicWidth(svg, wrapper, source);
  assert.ok(width > wrapper.clientWidth);
  assert.equal(wrapper.style.width, '100%');
  assert.equal(wrapper.style.maxWidth, '100%');
  assert.equal(wrapper.style.marginLeft, '0');
  assert.equal(wrapper.style.marginRight, '0');
  assert.equal(wrapper.style.overflowX, 'auto');
});


test('Gantt scroll container starts wide content at the left edge', () => {
  const css = fs.readFileSync(new URL('../../ui/src/styles/global/global-mermaid-rendering.css', import.meta.url), 'utf8');
  assert.match(css, /data-mdn-mermaid-kind="gantt"[^}]*justify-content:\s*flex-start/s);
  assert.match(css, /data-mdn-mermaid-kind="gantt"[^}]*align-items:\s*flex-start/s);
});

test('ZenUML document rendering is not clipped by the generic Mermaid height cap', () => {
  const css = fs.readFileSync(new URL('../../ui/src/styles/global/global-mermaid-rendering.css', import.meta.url), 'utf8');
  assert.match(css, /data-mdn-mermaid-kind="zenuml"[^}]*max-height:\s*none/s);
  assert.match(css, /data-mdn-mermaid-kind="zenuml"[^}]*\.mermaid svg[^}]*max-height:\s*none\s*!important/s);
});

test('SVG polish preserves native scaling for ZenUML frames and architecture arrowheads', () => {
  const makeGraphic = (className = '') => {
    const attrs = new Map(className ? [['class', className]] : []);
    return {
      setAttribute(name, value) { attrs.set(name, String(value)); },
      getAttribute(name) { return attrs.get(name) ?? null; },
      removeAttribute(name) { attrs.delete(name); },
    };
  };
  const zenFrame = makeGraphic('fragment');
  const zenSvg = {
    style: fakeStyle(),
    setAttribute() {},
    querySelectorAll() { return [zenFrame]; },
  };
  rendering.polishMermaidSvg(zenSvg, 'zenuml');
  assert.equal(zenFrame.getAttribute('vector-effect'), null);

  const edge = makeGraphic('edge');
  const arrow = makeGraphic('arrow');
  const architectureSvg = {
    style: fakeStyle(),
    setAttribute() {},
    querySelectorAll() { return [edge, arrow]; },
  };
  rendering.polishMermaidSvg(architectureSvg, 'architecture');
  assert.equal(edge.getAttribute('vector-effect'), 'non-scaling-stroke');
  assert.equal(arrow.getAttribute('vector-effect'), null);
});


test('ZenUML keeps Mermaid native viewBox so the diagram title is not clipped', async () => {
  const svg = fakeSvg();
  svg.setAttribute('viewBox', '0 0 900 760');
  svg.setAttribute('width', '900');
  svg.setAttribute('height', '760');
  const wrapper = { dataset: {}, style: fakeStyle() };
  const node = {
    dataset: {},
    textContent: 'zenuml\ntitle Theme-aware Mermaid Rendering\n@Actor User\nUser->Preview: Open document',
    svg: null,
    querySelector(selector) { return selector === 'svg' ? this.svg : null; },
    querySelectorAll(selector) { return selector === 'svg' && this.svg ? [this.svg] : []; },
    removeAttribute() {},
    closest() { return wrapper; },
  };
  const root = { querySelectorAll: () => node.dataset.mdnRendered ? [] : [node] };
  const mermaid = {
    initialize() {},
    async run() { node.svg = svg; },
  };

  await rendering.enhanceMermaid(root, {
    getLibrary: async () => mermaid,
    isDark: false,
    isCancelled: () => false,
    runIdRef: { current: 0 },
    document: { documentElement: {}, defaultView: { getComputedStyle: () => ({ getPropertyValue: () => '' }) } },
  });

  assert.equal(svg.getAttribute('viewBox'), '0 0 900 760');
  assert.equal(svg.getAttribute('width'), '900');
  assert.equal(svg.getAttribute('height'), '760');
});


test('Sankey keeps Mermaid native canvas geometry', async () => {
  const svg = fakeSvg();
  svg.setAttribute('viewBox', '0 0 600 400');
  svg.setAttribute('width', '600');
  svg.setAttribute('height', '400');
  const wrapper = { dataset: {}, style: fakeStyle() };
  const node = {
    dataset: {},
    textContent: 'sankey-beta\nSource,Parser,100\nParser,Preview,100',
    svg: null,
    querySelector(selector) { return selector === 'svg' ? this.svg : null; },
    querySelectorAll(selector) { return selector === 'svg' && this.svg ? [this.svg] : []; },
    removeAttribute() {},
    closest() { return wrapper; },
  };
  const root = { querySelectorAll: () => node.dataset.mdnRendered ? [] : [node] };
  const initialized = [];
  const mermaid = {
    initialize(options) { initialized.push(options); },
    async run() { node.svg = svg; },
  };

  await rendering.enhanceMermaid(root, {
    getLibrary: async () => mermaid,
    isDark: false,
    isCancelled: () => false,
    runIdRef: { current: 0 },
    document: { documentElement: {}, defaultView: { getComputedStyle: () => ({ getPropertyValue: () => '' }) } },
  });

  assert.ok(initialized[0].sankey.width >= 760, 'Sankey receives an adaptive layout width before render');
  assert.equal(initialized[0].sankey.useMaxWidth, false);
  assert.equal(svg.getAttribute('viewBox'), '0 0 600 400', 'post-processing does not rewrite native Sankey viewBox');
  assert.ok(Number.parseFloat(svg.getAttribute('width')) >= initialized[0].sankey.width);
  assert.equal(svg.getAttribute('height'), '400');
  assert.equal(wrapper.style.overflowX, 'auto');
  assert.equal(wrapper.style.width, '100%');
  assert.equal(wrapper.style.maxWidth, '100%');
});

test('Gantt body wrapper stays inside its parent while the SVG keeps intrinsic width', () => {
  const svg = fakeSvg();
  svg.setAttribute('width', '760');
  const wrapper = {
    clientWidth: 1000,
    style: fakeStyle({ width: '1568px', maxWidth: 'none', marginLeft: '-284px', marginRight: '-284px' }),
    closest(selector) {
      if (selector === '.mdn-body') return { clientWidth: 1000 };
      if (selector === '.content__scroll') return { clientWidth: 1600 };
      return null;
    },
  };
  const source = `gantt
    dateFormat YYYY-MM-DD
    section Delivery
    Product discovery and stakeholder alignment :2026-01-01, 20d
    Architecture constraints and dependency planning :2026-02-01, 20d
    Production rollout and observation :2026-06-01, 20d`;

  const width = rendering.applyGanttIntrinsicWidth(svg, wrapper, source);
  assert.ok(width > wrapper.clientWidth);
  assert.equal(svg.style.width, `${width}px`);
  assert.equal(svg.style.maxWidth, 'none');
  assert.equal(wrapper.style.width, '100%');
  assert.equal(wrapper.style.maxWidth, '100%');
  assert.equal(wrapper.style.marginLeft, '0');
  assert.equal(wrapper.style.marginRight, '0');
  assert.equal(wrapper.style.overflowX, 'auto');
});

test('ZenUML title stays visible with Mermaid font and neutral canvas contrast', () => {
  assert.equal(typeof rendering.repairZenUmlTitle, 'function');
  const svg = fakeLayerElement('svg', { x: 0, y: 0, width: 900, height: 760 });
  svg.setAttribute('viewBox', '0 0 900 760');
  const title = fakeLayerElement('text', { x: 24, y: 14, width: 280, height: 22 });
  title.textContent = 'Theme-aware Mermaid Rendering';
  title.setAttribute('fill', '#fefefe');
  svg.appendChild(title);

  rendering.repairZenUmlTitle(
    svg,
    contrastTokens,
    '"JetBrains Mono", monospace',
    'zenuml\n    title Theme-aware Mermaid Rendering\n    @Actor User\n    User->Preview: Open document',
  );

  assert.equal(svg.getAttribute('viewBox'), '0 0 900 760', 'title repair must preserve ZenUML native canvas');
  assert.equal(title.style.fontFamily, '"JetBrains Mono", monospace');
  assert.equal(title.getAttribute('fill'), '#111111', 'light canvas needs dark neutral title text');
  assert.equal(title.getAttribute('data-mdn-zenuml-title'), 'true');
});

test('Sankey deconflicts labels without mutating native node or ribbon geometry', () => {
  assert.equal(typeof rendering.repairSankeyLabelCollisions, 'function');

  const makeLabel = (textContent, x, y, width = 120, height = 18) => {
    const attrs = new Map([['x', String(x)], ['y', String(y)]]);
    return {
      textContent,
      attrs,
      getAttribute(name) { return attrs.get(name) ?? null; },
      setAttribute(name, value) { attrs.set(name, String(value)); },
      getBBox() {
        return { x: x - width / 2, y: Number(attrs.get('y')) - height / 2, width, height };
      },
    };
  };

  const labels = [
    makeLabel('Theme resolver', 300, 180),
    makeLabel('Mermaid renderer', 302, 184),
    makeLabel('SVG post processing', 300, 188),
    makeLabel('Document preview', 560, 210),
  ];
  const pathAttrs = new Map([['d', 'M10,20C100,20 200,120 290,120'], ['stroke-width', '48']]);
  const ribbon = {
    getAttribute(name) { return pathAttrs.get(name) ?? null; },
    setAttribute(name, value) { pathAttrs.set(name, String(value)); },
  };
  const nodeAttrs = new Map([['x', '290'], ['y', '100'], ['width', '12'], ['height', '80']]);
  const node = {
    getAttribute(name) { return nodeAttrs.get(name) ?? null; },
    setAttribute(name, value) { nodeAttrs.set(name, String(value)); },
  };
  const svgAttrs = new Map([['viewBox', '0 0 600 400'], ['width', '600'], ['height', '400']]);
  const svg = {
    getAttribute(name) { return svgAttrs.get(name) ?? null; },
    setAttribute(name, value) { svgAttrs.set(name, String(value)); },
    querySelectorAll(selector) {
      if (selector === 'g.node-labels text') return labels;
      if (selector === 'g.links path') return [ribbon];
      if (selector === 'g.nodes rect') return [node];
      return [];
    },
  };

  const originalPath = ribbon.getAttribute('d');
  const originalNode = [...nodeAttrs.entries()];
  rendering.repairSankeyLabelCollisions(svg, { gap: 8 });

  const boxes = labels.slice(0, 3).map((label) => label.getBBox()).sort((a, b) => a.y - b.y);
  for (let i = 1; i < boxes.length; i += 1) {
    assert.ok(boxes[i].y >= boxes[i - 1].y + boxes[i - 1].height + 8 - 0.001);
  }
  assert.equal(ribbon.getAttribute('d'), originalPath, 'native Sankey ribbon path must stay untouched');
  assert.deepEqual([...nodeAttrs.entries()], originalNode, 'native Sankey node geometry must stay untouched');
});

test('Sankey polish preserves native butt-ended ribbon strokes', () => {
  const attrs = new Map([['class', 'link']]);
  const ribbon = {
    getAttribute(name) { return attrs.get(name) ?? null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
  };
  const svg = {
    style: fakeStyle(),
    setAttribute() {},
    querySelectorAll() { return [ribbon]; },
  };
  rendering.polishMermaidSvg(svg, 'sankey');

  assert.equal(ribbon.getAttribute('vector-effect'), null, 'Sankey ribbon width should scale natively');
  assert.equal(ribbon.getAttribute('stroke-linecap'), null, 'default butt linecap prevents circular ribbon ends');
  assert.equal(ribbon.getAttribute('stroke-linejoin'), null);
});

test('Sankey raise labels places text on the highest layer above links and nodes', () => {
  assert.equal(typeof rendering.raiseSankeyLabels, 'function');
  const parent = {
    children: [],
    appendChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
      this.children.push(child);
    },
  };
  const nodesGroup = { name: 'nodes', parentElement: parent };
  const labelsGroup = { name: 'node-labels', parentElement: parent };
  const linksGroup = { name: 'links', parentElement: parent };
  parent.children = [nodesGroup, labelsGroup, linksGroup];

  const svg = {
    querySelector(sel) {
      if (sel === 'g.node-labels') return labelsGroup;
      return null;
    },
  };

  rendering.raiseSankeyLabels(svg);
  assert.equal(parent.children[parent.children.length - 1], labelsGroup, 'node-labels must be the last child to render on top');
});

test('ZenUML custom Mermaid font applies to every rendered text surface', () => {
  assert.equal(typeof rendering.enforceZenUmlFont, 'function');
  const svg = fakeLayerElement('svg', { x: 0, y: 0, width: 900, height: 760 });
  const title = fakeLayerElement('text', { x: 20, y: 10, width: 260, height: 22 });
  title.textContent = 'Theme-aware Mermaid Rendering';
  const actor = fakeLayerElement('text', { x: 100, y: 70, width: 80, height: 18 });
  actor.textContent = 'User';
  const message = fakeLayerElement('text', { x: 180, y: 130, width: 180, height: 18 });
  message.textContent = 'Open Markdown document';
  const tspan = fakeLayerElement('tspan', { x: 180, y: 130, width: 80, height: 18 });
  tspan.textContent = 'document';
  message.appendChild(tspan);
  const fragment = fakeLayerElement('text', { x: 400, y: 250, width: 60, height: 18 });
  fragment.textContent = 'Alt';
  const sequenceNumber = fakeLayerElement('text', { x: 350, y: 300, width: 30, height: 18 });
  sequenceNumber.textContent = '2.1.2';
  const foreignObject = fakeLayerElement('foreignObject', { x: 420, y: 320, width: 160, height: 28 });
  const div = fakeLayerElement('div', { x: 420, y: 320, width: 160, height: 28 });
  div.textContent = '[ cacheHit ]';
  foreignObject.appendChild(div);
  for (const element of [title, actor, message, fragment, sequenceNumber, foreignObject]) svg.appendChild(element);

  rendering.enforceZenUmlFont(svg, '"JetBrains Mono", monospace');

  for (const element of [title, actor, message, tspan, fragment, sequenceNumber, div]) {
    assert.equal(element.style.fontFamily, '"JetBrains Mono", monospace', element.textContent);
  }
});

test('Architecture repair never moves group header decoration independently from its group', () => {
  const shape = fakeArchitectureElement({ x: 40, y: 40, width: 80, height: 80 });
  const label = fakeArchitectureElement({ x: 45, y: 124, width: 70, height: 18 }, { class: 'architecture-service-label' });
  const service = {
    querySelectorAll(selector) {
      if (selector.includes('architecture-service-label') || selector.includes('text')) return [label];
      if (/rect|circle|ellipse|polygon|path/.test(selector)) return [shape];
      return [];
    },
  };
  const header = fakeArchitectureElement(
    { x: 30, y: 35, width: 95, height: 48 },
    { transform: 'translate(12 18)' },
  );
  const svg = {
    querySelectorAll(selector) {
      if (selector === 'g.architecture-service') return [service];
      if (selector === 'g.architecture-groups > g') return [header];
      return [];
    },
  };

  rendering.repairArchitectureLabelCollisions(svg);
  assert.equal(header.getAttribute('transform'), 'translate(12 18)');
  assert.equal(header.getAttribute('data-mdn-architecture-group-header-shifted'), null);
});

test('Architecture service labels get centered placement and a surface halo for readability', () => {
  const shape = fakeArchitectureElement({ x: 20, y: 10, width: 80, height: 60 });
  const label = fakeArchitectureElement({ x: 80, y: 58, width: 80, height: 18 }, { class: 'architecture-service-label' });
  const service = {
    querySelectorAll(selector) {
      if (selector.includes('architecture-service-label') || selector.includes('text')) return [label];
      if (/rect|circle|ellipse|polygon|path/.test(selector)) return [shape];
      return [];
    },
  };
  const svg = {
    querySelectorAll(selector) {
      if (selector === 'g.architecture-service') return [service];
      if (selector === 'g.architecture-groups > g') return [];
      return [];
    },
  };

  rendering.repairArchitectureLabelCollisions(svg);
  assert.equal(label.style.paintOrder, 'stroke fill');
  assert.match(label.style.stroke, /var\(--bg-s/);
  assert.equal(label.style.strokeWidth, '2.5px');
});

test('Sankey adaptive width grows with label and column pressure but stays bounded', () => {
  assert.equal(typeof rendering.estimateSankeyIntrinsicWidth, 'function');
  const small = 'sankey-beta\nA,B,10\nB,C,10';
  const dense = `sankey-beta
Markdown source,Block parser,100
Block parser,Markdown renderer,48
Block parser,Mermaid renderer,28
Block parser,Table renderer,14
Block parser,Math renderer,10
Markdown renderer,Document preview,48
Mermaid renderer,Theme resolver,28
Theme resolver,SVG post processing,28
SVG post processing,Document preview,28
Table renderer,Document preview,14
Math renderer,Document preview,10`;
  const smallWidth = rendering.estimateSankeyIntrinsicWidth(small, 720);
  const denseWidth = rendering.estimateSankeyIntrinsicWidth(dense, 720);
  assert.ok(smallWidth >= 720 && smallWidth < 1200);
  assert.ok(denseWidth > smallWidth, `${denseWidth} should be wider than ${smallWidth}`);
  assert.ok(denseWidth >= 1100, 'dense middle columns need enough horizontal room for labels');
  assert.ok(denseWidth <= 1800);
  assert.equal(rendering.estimateSankeyIntrinsicWidth(dense.repeat(20), 4000), 1800);
});


test('Sankey document view exposes intrinsic-width overflow through an internal horizontal scroller', () => {
  const css = fs.readFileSync(new URL('../../ui/src/styles/global/global-mermaid-rendering.css', import.meta.url), 'utf8');
  assert.match(css, /data-mdn-mermaid-kind="sankey"[^}]*overflow-x:\s*auto/s);
  assert.match(css, /data-mdn-mermaid-kind="sankey"[^}]*\.mermaid\s*\{[^}]*width:\s*max-content/s);
  assert.match(css, /data-mdn-mermaid-kind="sankey"[^}]*\.mermaid svg\s*\{[^}]*max-width:\s*none\s*!important/s);
});

test('Media modal SVG sizing preserves diagram aspect ratio and matches document background', () => {
  const css = fs.readFileSync(new URL('../../ui/src/styles/global/global-media-viewer-settings-shell.css', import.meta.url), 'utf8');
  assert.match(css, /\.mdn-modal-content-svg\s*\{[^}]*background:\s*var\(--bg\)/s);
  assert.match(css, /\.mdn-modal-content-svg\s*\{[^}]*overflow:\s*hidden/s);
  assert.doesNotMatch(css, /\.mdn-modal-content-svg\s*\{[^}]*min-width:/s);
  assert.doesNotMatch(css, /\.mdn-modal-content-svg\s*\{[^}]*min-height:/s);
  assert.match(css, /\.mdn-modal-content-svg svg\s*\{[^}]*width:\s*auto\s*!important/s);
  assert.match(css, /\.mdn-modal-content-svg svg\s*\{[^}]*min-width:\s*0\s*!important/s);
  assert.match(css, /\.mdn-modal-content-svg svg\s*\{[^}]*max-width:\s*100%\s*!important/s);
  assert.match(css, /\.mdn-modal-content-svg svg\s*\{[^}]*max-height:\s*calc\(80vh - 48px\)\s*!important/s);
});

test('Architecture edge curving transforms sharp 3-point kinks into smooth quadratic curves', () => {
  assert.equal(typeof rendering.curveArchitectureEdgePath, 'function');
  const kinked = 'M 0,0 L 50,20 L 100,100';
  const curved = rendering.curveArchitectureEdgePath(kinked);
  assert.match(curved, /^M 0,0 L [-\d.]+,[-\d.]+ Q 50,20 [-\d.]+,[-\d.]+ L 100,100$/);
});

test('Architecture edge curving preserves clean straight lines for horizontal and vertical connections', () => {
  const horizontal = 'M 20,50 L 120,50';
  assert.equal(rendering.curveArchitectureEdgePath(horizontal), 'M 20,50 L 120,50');

  const vertical = 'M 80,10 L 80,110';
  assert.equal(rendering.curveArchitectureEdgePath(vertical), 'M 80,10 L 80,110');
});

test('Architecture edge curving produces smooth cubic S-curves for diagonal connectors', () => {
  const diagonal = 'M 0,0 L 100,200';
  const curved = rendering.curveArchitectureEdgePath(diagonal);
  assert.match(curved, /^M 0,0 C 50,0 50,200 100,200$/);
});

test('Architecture group refinement adds rounded corners to bounding rectangles', () => {
  assert.equal(typeof rendering.enforceArchitectureGroupBounds, 'function');
  const rect = fakeArchitectureElement({ x: 10, y: 10, width: 200, height: 300 });
  const svg = {
    querySelectorAll(selector) {
      if (selector.includes('rect')) return [rect];
      return [];
    },
  };
  const count = rendering.enforceArchitectureGroupBounds(svg);
  assert.equal(count, 1);
  assert.equal(rect.getAttribute('rx'), '8');
  assert.equal(rect.getAttribute('ry'), '8');
  assert.equal(rendering.enforceArchitectureGroupBounds(svg), 0);
});

test('Sequence diagram responsive fitting preserves viewBox and sets fit-contain styles', () => {
  assert.equal(typeof rendering.fitSequenceSvg, 'function');
  const svg = {
    attrs: new Map([
      ['viewBox', '-50 -10 1050 1156'],
      ['width', '1050'],
      ['height', '1156'],
    ]),
    style: fakeStyle(),
    setAttribute(name, value) { this.attrs.set(name, String(value)); },
    getAttribute(name) { return this.attrs.get(name) ?? null; },
  };

  rendering.fitSequenceSvg(svg);
  assert.equal(svg.getAttribute('viewBox'), '-50 -10 1050 1156', 'viewBox must not be cropped to single actor');
  assert.equal(svg.getAttribute('preserveAspectRatio'), 'xMidYMid meet');
  assert.equal(svg.style.width, 'auto');
  assert.equal(svg.style.maxWidth, '100%');
  assert.equal(svg.style.maxHeight, 'var(--mermaid-max-h)');
});

test('Sequence diagram CSS provides high contrast text and surface colors', () => {
  const css = fs.readFileSync(new URL('../../ui/src/styles/global/global-mermaid-rendering.css', import.meta.url), 'utf8');
  assert.match(css, /data-mdn-mermaid-kind="sequence"[^}]*rect\.actor\s*\{[^}]*fill:\s*var\(--bg-s/s);
  assert.match(css, /data-mdn-mermaid-kind="sequence"[^}]*text\.actor[^}]*fill:\s*var\(--tx/s);
  assert.match(css, /data-mdn-mermaid-kind="sequence"[^}]*\.messageText[^}]*fill:\s*var\(--tx/s);
});

test('ER diagram and Gantt chart theme variables use dark mode compatible backgrounds', () => {
  const tokens = theme.readMermaidThemeTokens(undefined, true);
  const darkVars = theme.buildMermaidThemeVariables(tokens, true);
  assert.equal(darkVars.excludeBkgColor, 'rgba(255, 255, 255, 0.04)');
  assert.equal(darkVars.rowOdd, tokens.surface);
  assert.equal(darkVars.rowEven, tokens.background);
  assert.equal(darkVars.attributeBackgroundColorOdd, tokens.surface);
  assert.equal(darkVars.attributeBackgroundColorEven, tokens.background);

  const lightTokens = theme.readMermaidThemeTokens(undefined, false);
  const lightVars = theme.buildMermaidThemeVariables(lightTokens, false);
  assert.equal(lightVars.excludeBkgColor, 'rgba(0, 0, 0, 0.04)');
  assert.equal(lightVars.rowOdd, lightTokens.surface);
});

test('ER diagram and Gantt CSS enforce dark-mode friendly zebra and exclude range fills', () => {
  const css = fs.readFileSync(new URL('../../ui/src/styles/global/global-mermaid-rendering.css', import.meta.url), 'utf8');
  assert.match(css, /data-mdn-mermaid-kind="gantt"[^}]*\.exclude-range[^}]*fill:\s*color-mix/s);
  assert.match(css, /data-mdn-mermaid-kind="er"[^}]*\.row-rect-odd[^}]*fill:\s*var\(--bg-s\)/s);
  assert.match(css, /data-mdn-mermaid-kind="er"[^}]*\.row-rect-even[^}]*fill:\s*var\(--bg-e/s);
  assert.match(css, /data-mdn-mermaid-kind="er"[^}]*text[^}]*fill:\s*var\(--tx\)/s);
});

test('Packet diagram CSS enforces theme surface background for shapes and high contrast text', () => {
  const css = fs.readFileSync(new URL('../../ui/src/styles/global/global-mermaid-rendering.css', import.meta.url), 'utf8');
  assert.match(css, /data-mdn-mermaid-kind="packet"[^}]*rect\.packetBlock[^}]*fill:\s*var\(--bg-s\)/s);
  assert.match(css, /data-mdn-mermaid-kind="packet"[^}]*text\.packetLabel[^}]*fill:\s*var\(--tx\)/s);
  assert.match(css, /data-mdn-mermaid-kind="packet"[^}]*text\.packetByte[^}]*fill:\s*var\(--tx2\)/s);
  assert.match(css, /data-mdn-mermaid-kind="packet"[^}]*text\.packetTitle[^}]*fill:\s*var\(--tx\)/s);
});

test('ZenUML diagram CSS enforces theme surface background for body and high contrast text', () => {
  const css = fs.readFileSync(new URL('../../ui/src/styles/global/global-mermaid-rendering.css', import.meta.url), 'utf8');
  assert.match(css, /data-mdn-mermaid-kind="zenuml"[^}]*rect\.frame-border-inner[^}]*fill:\s*var\(--bg-s/s);
  assert.match(css, /data-mdn-mermaid-kind="zenuml"[^}]*rect\.participant-box[^}]*fill:\s*var\(--bg-s/s);
  assert.match(css, /data-mdn-mermaid-kind="zenuml"[^}]*line\.message-line[^}]*stroke:\s*var\(--tx\)/s);
  assert.match(css, /data-mdn-mermaid-kind="zenuml"[^}]*line\.return-line[^}]*stroke:\s*var\(--tx\)/s);
  assert.match(css, /data-mdn-mermaid-kind="zenuml"[^}]*text\.message-label[^}]*fill:\s*var\(--tx\)/s);
  assert.match(css, /data-mdn-mermaid-kind="zenuml"[^}]*text\.return-label[^}]*fill:\s*var\(--tx\)/s);
  assert.match(css, /data-mdn-mermaid-kind="zenuml"[^}]*text\.participant-label[^}]*fill:\s*var\(--tx\)/s);
});

test('Sankey diagram CSS preserves vibrant flow ribbon colors without dark mode multiply darkening', () => {
  const css = fs.readFileSync(new URL('../../ui/src/styles/global/global-mermaid-rendering.css', import.meta.url), 'utf8');
  assert.match(css, /data-mdn-mermaid-kind="sankey"[^}]*\.link[^}]*mix-blend-mode:\s*normal/s);
  assert.match(css, /data-mdn-mermaid-kind="sankey"[^}]*\.sankey-label-fg[^}]*fill:\s*var\(--tx\)/s);
});

test('Kanban board CSS enforces theme surface background for cards and high contrast text', () => {
  const css = fs.readFileSync(new URL('../../ui/src/styles/global/global-mermaid-rendering.css', import.meta.url), 'utf8');
  assert.match(css, /data-mdn-mermaid-kind="kanban"[^}]*\.cluster-label[^}]*fill:\s*var\(--tx\)/s);
  assert.match(css, /data-mdn-mermaid-kind="kanban"[^}]*\.node rect[^}]*fill:\s*var\(--bg-s\)/s);
  assert.match(css, /data-mdn-mermaid-kind="kanban"[^}]*\.node text[^}]*fill:\s*var\(--tx\)/s);
});




