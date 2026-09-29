import { afterEach, describe, expect, it } from 'vitest';
import {
  findDocumentRootFor,
  getActiveDocumentBody,
  getActiveDocumentRoot,
  getActiveDocumentScroll,
  registerDocumentRoot,
  resetDocumentRoots,
  setActiveDocumentRootId,
} from '../../../../ui/src/document/activeDocumentRoot';

function el(id?: string) {
  const node = document.createElement('div');
  if (id) node.id = id;
  document.body.appendChild(node);
  return node;
}

afterEach(() => {
  resetDocumentRoots();
  document.body.innerHTML = '';
});

describe('active document registry', () => {
  it('falls back to #mdBody and #contentScroll when nothing is registered', () => {
    const body = el('mdBody');
    const scroll = el('contentScroll');
    expect(getActiveDocumentBody()).toBe(body);
    expect(getActiveDocumentScroll()).toBe(scroll);
  });

  it('returns the active pane entry and falls back after unregister', () => {
    const primary = el();
    const secondary = el();
    registerDocumentRoot({ id: 'primary', body: primary, scroll: null, filePath: '/a.md', markdownSource: '# A' });
    const off = registerDocumentRoot({ id: 'secondary', body: secondary, scroll: null, filePath: '/b.md', markdownSource: '# B' });
    setActiveDocumentRootId('secondary');
    expect(getActiveDocumentBody()).toBe(secondary);
    off();
    expect(getActiveDocumentRoot()?.id).toBe('primary');
  });

  it('prefers main when the active id is not registered', () => {
    const main = el();
    registerDocumentRoot({ id: 'main', body: main, scroll: null, filePath: null, markdownSource: null });
    setActiveDocumentRootId('secondary');
    expect(getActiveDocumentBody()).toBe(main);
  });

  it('finds the root that contains an element', () => {
    const pane = el();
    const child = document.createElement('span');
    pane.appendChild(child);
    registerDocumentRoot({ id: 'secondary', body: pane, scroll: null, filePath: '/b.md', markdownSource: 'x' });
    expect(findDocumentRootFor(child)?.filePath).toBe('/b.md');
    expect(findDocumentRootFor(el())).toBeNull();
  });
});
