import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const op = vi.hoisted(() => ({ current: null as any, clear: vi.fn() }));
vi.mock('../../../../ui/src/desktop/workspaceOperations', () => ({
  getActiveWorkspaceOperation: () => op.current,
  clearWorkspaceOperation: op.clear,
}));

import { useDesktopTabManagement } from '../../../../ui/src/hooks/useDesktopTabManagement';

const t = (id: string, kind = 'workspace', extra: Record<string, any> = {}): any => ({ id, kind, ...extra });

function setup(initial: any[], active: string, extra: Record<string, any> = {}) {
  let tabs = initial;
  const setTabs = vi.fn((u: any) => { tabs = typeof u === 'function' ? u(tabs) : u; });
  const aliases: any = { current: { '/w': 'Old' } };
  const setWorkspaceAliases = vi.fn((u: any) => { aliases.current = u(aliases.current); });
  const o: any = {
    tabs: initial, tabsRef: { current: initial }, activeTabIdRef: { current: active }, pendingWorkspaceTabIdRef: { current: 'p' },
    setTabs, setActiveTabId: vi.fn(), setWorkspaceAliases, activateTab: vi.fn(), bridge: { postMessage: vi.fn() },
    dispatchEmptyWorkspace: vi.fn(), isTabView: true, setNavigationScope: vi.fn(), ...extra,
  };
  const { result } = renderHook(() => useDesktopTabManagement(o));
  return { o, r: result.current, tabs: () => tabs, aliases };
}

beforeEach(() => { vi.useFakeTimers(); op.current = null; op.clear.mockClear(); });
afterEach(() => vi.useRealTimers());

describe('useDesktopTabManagement edges', () => {
  it('cancels the scan of a closed tab and falls back to home when the last tab closes', () => {
    op.current = { workspaceTabId: 'a', workspaceOperationId: 'op1' };
    const s = setup([t('a')], 'a');
    s.r.closeTab('a');
    expect(s.o.bridge.postMessage).toHaveBeenCalledWith({ command: 'cancelWorkspaceScan', workspaceOperationId: 'op1' });
    expect(s.o.pendingWorkspaceTabIdRef.current).toBeNull();
    expect(s.tabs()[0].kind).toBe('home');
    vi.runAllTimers();
    expect(s.o.activateTab).toHaveBeenCalledWith('home');
    s.r.closeTab('missing');
    s.r.reorderTabs('a', 'a');
    s.r.reorderTabs('', 'a');
  });

  it('closes tabs to the right including the active one and keeps tabs when nothing is to the right', () => {
    op.current = { workspaceTabId: 'c', workspaceOperationId: 'op2' };
    const guard = vi.fn((commit: () => void) => commit());
    const s = setup([t('h', 'home'), t('a'), t('b'), t('c')], 'c', { guardWorkspaceLeave: guard });
    s.r.closeTabsToRight('a');
    expect(guard).toHaveBeenCalled();
    expect(s.tabs().map((x: any) => x.id)).toEqual(['h', 'a']);
    vi.runAllTimers();
    expect(s.o.activateTab).toHaveBeenCalledWith('a');
    const before = s.tabs();
    s.r.closeTabsToRight('missing');
    expect(s.tabs()).toBe(before);
  });

  it('closes other tabs, ignores home targets and resets everything on close all', () => {
    const s = setup([t('h', 'home'), t('a'), t('b')], 'b', { isTabView: false });
    s.r.closeOtherTabs('h');
    expect(s.tabs()).toHaveLength(3);
    s.r.closeOtherTabs('a');
    expect(s.tabs().map((x: any) => x.id)).toEqual(['h', 'a']);
    vi.runAllTimers();
    expect(s.o.activateTab).toHaveBeenCalledWith('a');
    s.r.closeAllTabs();
    vi.runAllTimers();
    expect(s.o.setNavigationScope).toHaveBeenCalledWith('focus');
    expect(s.o.bridge.postMessage).toHaveBeenCalledWith({ command: 'closeWorkspace' });
    const noHome = setup([t('a')], 'a');
    noHome.r.closeAllTabs();
    vi.runAllTimers();
    expect(noHome.o.setNavigationScope).toHaveBeenCalledWith('home');
  });

  it('persists or clears workspace aliases and renames plain tabs', () => {
    const tabs = [t('a', 'workspace', { workspacePath: '/w', workspaceName: 'W' }), t('n', 'home')];
    const s = setup(tabs, 'a');
    s.r.updateTabAlias('a', ' W ');
    expect(s.aliases.current).toEqual({});
    s.r.updateTabAlias('a', 'Mine');
    expect(s.aliases.current).toEqual({ '/w': 'Mine' });
    s.r.updateTabAlias('n', '  ');
    expect(s.tabs().find((x: any) => x.id === 'n').alias).toBeUndefined();
    s.r.updateTabAlias('n', 'Named');
    expect(s.tabs().find((x: any) => x.id === 'n').alias).toBe('Named');
    s.r.updateTabAlias('missing', 'x');
    s.r.updateWorkspaceAlias('/w', 'Z');
    expect(s.aliases.current['/w']).toBe('Z');
  });
});
