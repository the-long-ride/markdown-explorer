import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavigationProvider, useNavigation, type WikiResolver } from '../../../ui/src/contexts/NavigationContext';

vi.mock('../../../ui/src/contexts/AppStateContext', () => ({ useAppState: () => ({ navigate: vi.fn() }) }));

const resolver: WikiResolver = {
  resolve: vi.fn(async (rawTarget: string, sourceDocumentPath: string) => ({
    status: 'resolved', canonicalPath: 'docs/A.md', fragment: rawTarget === 'Later' ? 'later' : 'install', sourceDocumentPath,
  })) as any,
};
const wrapper = ({ children }: { children: ReactNode }) => <NavigationProvider wikiResolver={resolver}>{children}</NavigationProvider>;

function body(fragmentId: string | null) {
  const el = document.createElement('div');
  el.id = 'mdBody';
  el.dataset.mdnSourceDocumentPath = 'docs/A.md';
  el.innerHTML = `<div class="mdn-section" data-expanded="false"><div class="mdn-section"><h2 ${fragmentId ? `id="${fragmentId}"` : ''}>T</h2></div></div>`;
  document.body.append(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); });

describe('wiki fragment scrolling', () => {
  it('scrolls immediately to an already rendered fragment with reduced motion and expands sections', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const el = body('install');
    const target = el.querySelector('h2') as HTMLElement;
    target.scrollIntoView = vi.fn();
    const { result } = renderHook(() => useNavigation(), { wrapper });
    await act(async () => { await result.current.navigateWikiLink('Now', 'docs/Start.md'); });
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    expect((el.querySelector('.mdn-section') as HTMLElement).dataset.expanded).toBe('true');
  });

  it('waits for the fragment to render and ignores malformed wiki events', async () => {
    const el = body(null);
    el.dataset.mdnSourceDocumentPath = 'docs/Other.md';
    const { result } = renderHook(() => useNavigation(), { wrapper });
    await act(async () => { await result.current.navigateWikiLink('Later', 'docs/Start.md'); });
    const scroll = vi.fn();
    await act(async () => {
      el.dataset.mdnSourceDocumentPath = 'docs/A.md';
      const h = document.createElement('h3'); h.id = 'later'; h.scrollIntoView = scroll; el.append(h);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(scroll).toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new CustomEvent('mdn-wiki-navigate'));
      window.dispatchEvent(new CustomEvent('mdn-wiki-navigate', { detail: { rawTarget: 1 } }));
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent('mdn-wiki-navigate', { detail: { rawTarget: 'Now', sourceDocumentPath: 'docs/Start.md' } }));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(resolver.resolve).toHaveBeenCalledWith('Now', 'docs/Start.md');
  });
});
