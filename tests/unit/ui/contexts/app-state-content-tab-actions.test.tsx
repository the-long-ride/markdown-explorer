import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

let ctx: ReturnType<typeof useAppState>;
function Harness() { ctx = useAppState(); return null; }

function setup() {
  const bridge = {
    postMessage: vi.fn(), onMessage: vi.fn(() => () => undefined),
    getState: vi.fn(() => ({ fileTabs: true })), setState: vi.fn(), copyToClipboard: vi.fn(),
  } as unknown as PlatformBridge;
  render(<PlatformProvider bridge={bridge}><AppStateProvider><Harness /></AppStateProvider></PlatformProvider>);
  for (const name of ['a', 'b', 'c']) {
    act(() => ctx.dispatch({ type: 'RENDER_CONTENT', msg: { command: 'renderContent', html: `<p>${name}</p>`, markdownSource: name, frontmatter: {}, toc: [], filePath: `/d/${name}.md`, relativePath: `${name}.md`, title: name, fileList: [], previewInfo: null } as any }));
  }
  const navigations = () => (bridge.postMessage as any).mock.calls.filter((c: any[]) => c[0].command === 'navigate').map((c: any[]) => c[0].path);
  return { bridge, navigations };
}

describe('AppStateProvider content tab actions', () => {
  it('navigates to a neighbour when the active tab closes and stays put otherwise', () => {
    const s = setup();
    expect(ctx.state.contentTabs.length).toBe(3);
    act(() => ctx.closeContentTab('/d/missing.md'));
    act(() => ctx.closeContentTab('/d/a.md'));
    expect(s.navigations()).toEqual([]);
    act(() => ctx.closeContentTab(ctx.state.activeContentTabPath!));
    expect(s.navigations()).toEqual(['/d/b.md']);
  });

  it('closes tabs to the right and other tabs with navigation only when needed', () => {
    const s = setup();
    act(() => ctx.closeContentTabsToRight('/d/c.md'));
    act(() => ctx.closeContentTabsToRight('/d/missing.md'));
    act(() => ctx.closeContentTabsToRight('/d/a.md'));
    expect(s.navigations()).toEqual(['/d/a.md']);
    expect(ctx.state.contentTabs.length).toBe(1);
    act(() => ctx.closeOtherContentTabs('/d/a.md'));
    act(() => ctx.closeAllContentTabs());
    expect(s.navigations().at(-1)).toBe('');
    act(() => ctx.closeAllContentTabs());
  });

  it('closes other tabs around an inactive target and moves files between split panes', () => {
    const s = setup();
    act(() => ctx.closeOtherContentTabs('/d/a.md'));
    expect(s.navigations()).toEqual(['/d/a.md']);
    act(() => ctx.moveToOtherPane(''));
    act(() => ctx.moveToOtherPane('/d/a.md'));
    expect(ctx.state.splitView.enabled).toBe(true);
    act(() => ctx.moveToOtherPane('/d/a.md'));
    act(() => ctx.openInSplit(''));
    act(() => ctx.reorderContentTabs('/d/a.md', '/d/a.md'));
  });
});
