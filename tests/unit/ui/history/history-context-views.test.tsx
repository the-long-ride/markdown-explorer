import React, { type ReactNode } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ state: {} as any, setSplitPaneMode: vi.fn(), openSidebar: vi.fn(), modal: null as any, bridge: { postMessage: () => undefined, onMessage: () => () => undefined } }));
vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({ usePlatform: () => h.bridge }));
vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({ useAppState: () => ({ state: h.state, setSplitPaneMode: h.setSplitPaneMode, openRepositoryHistorySidebar: h.openSidebar }) }));
vi.mock('../../../../ui/src/components/History/FileHistoryModal', () => ({ FileHistoryModal: (p: any) => { h.modal = p; return null; } }));
vi.mock('../../../../ui/src/history/historyClient', () => ({ createHistoryClient: () => ({ isDisposed: () => false, dispose: vi.fn() }) }));

import { HistoryProvider, useHistory } from '../../../../ui/src/contexts/HistoryContext';
import { DOCUMENT_HISTORY_OPEN_EVENT } from '../../../../ui/src/components/shared/ToolbarActionMenu';
import { DOCUMENT_COMPARE_REQUEST_EVENT } from '../../../../ui/src/editor/useDocumentConflictResolution';
import { documentSessionKey } from '../../../../ui/src/editor/documentSession';

const wrapper = ({ children }: { children: ReactNode }) => <HistoryProvider>{children}</HistoryProvider>;

describe('HistoryProvider views', () => {
  it('targets the active split pane for compare views and clears them back to rendered', () => {
    h.state = { settings: { language: 'en' }, currentFile: '/w/a.md', workspacePath: '/w', documentSessions: {}, splitView: { enabled: true, activePane: 'secondary', primary: { filePath: '/w/a.md' }, secondary: { filePath: null } } };
    const { result } = renderHook(() => useHistory(), { wrapper });
    act(() => { window.dispatchEvent(new CustomEvent(DOCUMENT_COMPARE_REQUEST_EVENT, { detail: {} })); });
    expect(result.current.historyViews).toEqual({});
    act(() => { window.dispatchEvent(new CustomEvent(DOCUMENT_COMPARE_REQUEST_EVENT, { detail: { filePath: '/w/a.md', leftSource: 'l', rightSource: 'r' } })); });
    expect(result.current.historyViews.secondary?.mode).toBe('diff');
    expect(h.setSplitPaneMode).toHaveBeenCalledWith('secondary', 'diff');
    act(() => result.current.clearHistoryView());
    expect(h.setSplitPaneMode).toHaveBeenCalledWith('secondary', 'rendered');
    act(() => result.current.clearHistoryView('single'));
  });

  it('opens the sidebar without a path, the modal with one and exposes the current source', () => {
    h.state = { settings: { language: 'en' }, currentFile: null, workspacePath: '/w', documentSessions: { [documentSessionKey('/w/b.md')]: { source: 'src' } }, splitView: { enabled: false, activePane: 'primary', primary: {}, secondary: {} } };
    const { result } = renderHook(() => useHistory(), { wrapper });
    act(() => { window.dispatchEvent(new CustomEvent(DOCUMENT_HISTORY_OPEN_EVENT)); });
    expect(h.openSidebar).toHaveBeenCalled();
    act(() => result.current.openHistory());
    expect(h.modal).toBeNull();
    act(() => { window.dispatchEvent(new CustomEvent(DOCUMENT_HISTORY_OPEN_EVENT, { detail: { filePath: '/w/b.md' } })); });
    expect(h.modal.currentSource()).toBe('src');
    act(() => h.modal.onClose());
  });
});
