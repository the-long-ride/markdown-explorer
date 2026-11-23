import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { TOUR_DEMO_WORKSPACE_PATH } from '../../../../ui/src/components/Tour/tourDemoWorkspace';

function setup() {
  const handlers = new Set<(message: any) => void>();
  const bridge = {
    postMessage: vi.fn(),
    onMessage: vi.fn((handler: (message: any) => void) => { handlers.add(handler); return () => handlers.delete(handler); }),
    getState: vi.fn(() => ({})),
    setState: vi.fn(),
    copyToClipboard: vi.fn(),
  } as unknown as PlatformBridge & { postMessage: ReturnType<typeof vi.fn> };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PlatformProvider bridge={bridge}><AppStateProvider>{children}</AppStateProvider></PlatformProvider>
  );
  const hook = renderHook(() => useAppState(), { wrapper });
  const posted = (command: string) => bridge.postMessage.mock.calls.map(([m]: any[]) => m).filter((m: any) => m.command === command);
  const emit = (message: any) => act(() => { for (const handler of [...handlers]) handler(message); });
  return { bridge, posted, emit, ...hook };
}

function render(result: ReturnType<typeof setup>['result'], filePath: string) {
  const name = filePath.split('/').pop()!;
  act(() => result.current.dispatch({ type: 'RENDER_CONTENT', msg: {
    command: 'render', filePath, fileName: name, relativePath: name, html: `<p>${name}</p>`, markdownSource: name,
  } as any }));
}

function withTabs(paths: string[]) {
  const ctx = setup();
  act(() => ctx.result.current.updateSettings({ fileTabs: true }));
  for (const path of paths) render(ctx.result, path);
  ctx.bridge.postMessage.mockClear();
  return ctx;
}

describe('AppStateProvider actions', () => {
  it('manages content tabs: activate, reorder, close and close variants', () => {
    const { result, posted } = withTabs(['/w/a.md', '/w/b.md', '/w/c.md']);
    expect(result.current.state.contentTabs.map(t => t.filePath)).toEqual(['/w/a.md', '/w/b.md', '/w/c.md']);

    act(() => result.current.activateContentTab(''));
    act(() => result.current.activateContentTab('/w/b.md'));
    expect(posted('navigate').at(-1)).toMatchObject({ path: '/w/b.md' });

    act(() => result.current.reorderContentTabs('', '/w/a.md'));
    act(() => result.current.reorderContentTabs('/w/a.md', '/w/a.md'));
    act(() => result.current.reorderContentTabs('/w/c.md', '/w/a.md'));
    expect(result.current.state.contentTabs[0].filePath).toBe('/w/c.md');

    act(() => result.current.closeContentTabsToRight('/missing.md'));
    act(() => result.current.closeContentTabsToRight(result.current.state.contentTabs.at(-1)!.filePath));
    const navBefore = posted('navigate').length;
    act(() => result.current.closeContentTab('/missing.md'));
    expect(posted('navigate')).toHaveLength(navBefore);
    act(() => result.current.closeContentTabsToRight('/w/c.md'));
    expect(result.current.state.contentTabs.map(t => t.filePath)).toEqual(['/w/c.md']);
  });

  it('closes other tabs, all tabs and the active tab with a fallback', () => {
    const { result, posted } = withTabs(['/w/a.md', '/w/b.md', '/w/c.md']);
    act(() => result.current.closeOtherContentTabs('/missing.md'));
    act(() => result.current.closeOtherContentTabs('/w/a.md'));
    expect(result.current.state.contentTabs.map(t => t.filePath)).toEqual(['/w/a.md']);
    expect(posted('navigate').at(-1)).toMatchObject({ path: '/w/a.md' });
    act(() => result.current.closeOtherContentTabs('/w/a.md'));
    render(result, '/w/d.md');
    act(() => result.current.closeContentTab('/w/d.md'));
    expect(posted('navigate').at(-1)).toMatchObject({ path: '/w/a.md' });
    act(() => result.current.closeAllContentTabs());
    expect(result.current.state.contentTabs).toHaveLength(0);
    expect(posted('navigate').at(-1)).toMatchObject({ path: '' });
    const count = posted('navigate').length;
    act(() => result.current.closeAllContentTabs());
    expect(posted('navigate')).toHaveLength(count);
  });

  it('routes tour demo paths locally and handles split helpers', () => {
    const { result, posted } = withTabs(['/w/a.md']);
    const demo = `${TOUR_DEMO_WORKSPACE_PATH}/Welcome.md`;
    act(() => result.current.navigate(`${demo}#intro`, { htmlPreviewOverride: true }));
    act(() => result.current.activateContentTab(demo));
    expect(posted('navigate')).toHaveLength(0);
    act(() => result.current.refresh());
    expect(posted('refresh')).toHaveLength(0);

    act(() => result.current.openInSplit(''));
    act(() => result.current.moveToOtherPane(''));
    act(() => result.current.moveToOtherPane('/w/a.md'));
    expect(result.current.state.splitView.enabled).toBe(true);
    act(() => result.current.navigate(`${demo}`));
    act(() => result.current.moveToOtherPane('/w/a.md'));
    act(() => result.current.moveSplitTab('primary', 'secondary', '/w/a.md', 0));
    expect(posted('navigate').at(-1)).toMatchObject({ path: '/w/a.md' });
  });

  it('refreshes, opens in editor and forwards appearance changes', () => {
    const { result, posted, emit } = setup();
    act(() => result.current.openInEditor());
    act(() => result.current.refresh());
    expect(posted('openInEditor')).toHaveLength(0);
    expect(posted('refresh')).toHaveLength(0);
    render(result, '/w/a.md');
    act(() => result.current.openInEditor());
    act(() => result.current.refresh());
    expect(posted('openInEditor')).toEqual([{ command: 'openInEditor', path: '/w/a.md' }]);
    expect(posted('refresh')).toHaveLength(1);
    emit({ command: 'requestSaveCurrentDocument' });
    emit({ command: 'unrelated' });

    act(() => result.current.setTheme('dark'));
    act(() => result.current.setThemeStyle('github' as any));
    expect(posted('updateAppearance').at(-1)).toMatchObject({ theme: 'dark', themeStyle: 'github' });

    act(() => result.current.updateSettings({ customThemes: [
      { id: 'night', name: 'Night', baseStyle: 'github', colorMode: 'dark', tokens: {} },
      { id: 'plain', name: 'Plain', baseStyle: 'github', tokens: {} },
    ] as any }));
    act(() => result.current.selectCustomTheme('night'));
    act(() => result.current.selectCustomTheme('plain'));
    act(() => result.current.selectCustomTheme(undefined));
    expect(posted('updateAppearance').length).toBeGreaterThanOrEqual(2);

    const mode = result.current.state.settings.desktopViewMode;
    act(() => result.current.toggleDesktopViewMode());
    expect(result.current.state.settings.desktopViewMode).not.toBe(mode);
    act(() => result.current.toggleDesktopViewMode());
    const preview = result.current.state.settings.defaultHtmlPreview;
    act(() => result.current.toggleDefaultHtmlPreview());
    expect(result.current.state.settings.defaultHtmlPreview).toBe(!preview);
    act(() => result.current.setContentTabHtmlPreview('/w/a.md', true));
  });
});
