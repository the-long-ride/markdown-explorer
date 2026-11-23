import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SplitContent } from '../../../../ui/src/components/Content/SplitContent';
import { DOCUMENT_HISTORY_OPEN_EVENT } from '../../../../ui/src/components/shared/ToolbarActionMenu';
import { initialState, type AppState } from '../../../../ui/src/contexts/appStateModel';
import { getTranslations } from '../../../../ui/src/contexts/translations';
import { createEditableDocumentSession, documentSessionKey } from '../../../../ui/src/editor/documentSession';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';
import { beginSplitPointerDrag } from '../../../../ui/src/split-view/splitPointerDrag';

const context = vi.hoisted(() => ({ current: {} as Record<string, unknown>, postMessage: vi.fn() }));
vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({ useAppState: () => context.current }));
vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({ usePlatform: () => ({ postMessage: context.postMessage }) }));
vi.mock('../../../../ui/src/components/Content/SplitPaneDocument', () => ({ SplitPaneDocument: () => null }));

const first = '/docs/a.md';
const second = '/docs/b.md';
const html = '/docs/c.html';
const last = '/docs/d.md';
const t = getTranslations('en');

function fixture(activePrimary = second, dirtyPath?: string, overrides: Partial<AppState> = {}) {
  const split = createSplitViewState(first);
  const state: AppState = {
    ...initialState,
    appRuntime: 'desktop',
    settings: { ...initialState.settings, language: 'en', fileTabs: true, defaultHtmlPreview: false },
    contentTabs: [first, second, html, last].map((filePath) => ({
      filePath, fileName: filePath.slice(6), relativePath: filePath.slice(6), title: filePath.slice(6),
    })),
    documentSessions: dirtyPath ? {
      [documentSessionKey(dirtyPath)]: { ...createEditableDocumentSession(dirtyPath, 'Before', '1'), source: 'After' },
    } : {},
    splitView: {
      ...split, enabled: true,
      primary: { ...split.primary, tabs: [first, second, html], activeTabPath: activePrimary, filePath: activePrimary },
      secondary: { ...split.secondary, tabs: [last], activeTabPath: last, filePath: last },
    },
    ...overrides,
  };
  const app = {
    state, dispatch: vi.fn(), openInSplit: vi.fn(), swapSplitPanes: vi.fn(),
    closeSplitView: vi.fn(), guardUnsavedChanges: vi.fn<(paths: string[], commit: () => void) => void>(),
    setContentTabHtmlPreview: vi.fn(), activatePane: vi.fn(),
  };
  context.current = app;
  render(<SplitContent />);
  return app;
}

function tab(name: string) { return screen.getByRole('tab', { name }); }
function menuAction(tabName: string, action: string | RegExp) {
  fireEvent.contextMenu(tab(tabName), { clientX: 10, clientY: 20 });
  fireEvent.click(screen.getByRole('menuitem', {
    name: typeof action === 'string' ? (name) => name.startsWith(action) : action,
  }));
}

describe('split content tab actions', () => {
  it('activates a pane tab and synchronizes the cached content and host', () => {
    const { dispatch } = fixture();
    fireEvent.click(tab('a.md'));
    expect(dispatch.mock.calls.flat()).toEqual([
      { type: 'ACTIVATE_SPLIT_PANE', paneId: 'primary' },
      { type: 'ACTIVATE_SPLIT_PANE_TAB', paneId: 'primary', filePath: first },
      { type: 'ACTIVATE_CONTENT_TAB', filePath: first },
    ]);
    expect(context.postMessage).toHaveBeenCalledExactlyOnceWith({ command: 'navigate', path: first });
  });

  it('uses file-list labels for uncached pane tabs and navigates without activating a cached document', () => {
    const fileList: AppState['fileList'] = [
      { fsPath: first, relativePath: 'a.md', fileName: 'a.md', title: 'Listed A', parts: ['a.md'], extension: '.md', modifiedAt: 0 },
      { fsPath: second, relativePath: 'b.md', fileName: 'b.md', title: '', parts: ['b.md'], extension: '.md', modifiedAt: 0 },
    ];
    const { dispatch } = fixture(second, undefined, {
      contentTabs: [{ filePath: html, fileName: 'c.html', relativePath: 'c.html', title: '' }],
      fileList,
      settings: { ...initialState.settings, fileTabs: true, showTitle: true },
    });
    expect(tab('b.md')).toBeInTheDocument();
    expect(tab('c.html')).toBeInTheDocument();
    fireEvent.click(tab('Listed A'));
    expect(dispatch.mock.calls.flat()).toEqual([
      { type: 'ACTIVATE_SPLIT_PANE', paneId: 'primary' },
      { type: 'ACTIVATE_SPLIT_PANE_TAB', paneId: 'primary', filePath: first },
    ]);
    expect(context.postMessage).toHaveBeenCalledExactlyOnceWith({ command: 'navigate', path: first });
  });

  it('closes an inactive tab without navigating and an active tab using its left neighbour', () => {
    const { dispatch } = fixture();
    menuAction('c.html', t.tabContextMenu.closeThisTab);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: html });
    expect(context.postMessage).not.toHaveBeenCalled();
    fireEvent.click(within(tab('b.md')).getByRole('button', { name: /close/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: second });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'ACTIVATE_CONTENT_TAB', filePath: first });
    expect(context.postMessage).toHaveBeenCalledExactlyOnceWith({ command: 'navigate', path: first });
  });

  it('navigates to an uncached sibling after closing the active tab without activating a cached document', () => {
    const { dispatch } = fixture(second, undefined, {
      contentTabs: [{ filePath: second, fileName: 'b.md', relativePath: 'b.md', title: 'B' }],
    });
    fireEvent.click(within(tab('B')).getByRole('button', { name: /close/i }));
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: second });
    expect(context.postMessage).toHaveBeenCalledExactlyOnceWith({ command: 'navigate', path: first });
  });

  it('does not navigate to an empty opposite pane when closing all tabs', () => {
    const split = createSplitViewState(first);
    const { dispatch } = fixture(first, undefined, {
      splitView: {
        ...split,
        enabled: true,
        primary: { ...split.primary, tabs: [first, second], activeTabPath: first, filePath: first },
        secondary: { ...split.secondary, tabs: [], activeTabPath: null, filePath: null },
      },
    });
    menuAction('a.md', t.tabContextMenu.closeAllTabs);
    expect(dispatch.mock.calls.flat()).toEqual([
      { type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: first },
      { type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: second },
    ]);
    expect(context.postMessage).not.toHaveBeenCalled();
  });

  it('uses the right neighbour when closing the first active tab, and the opposite pane when closing its last tab', () => {
    const { dispatch } = fixture(first);
    menuAction('a.md', t.tabContextMenu.closeThisTab);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'ACTIVATE_CONTENT_TAB', filePath: second });
    expect(context.postMessage).toHaveBeenLastCalledWith({ command: 'navigate', path: second });
    menuAction('d.md', t.tabContextMenu.closeThisTab);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'secondary', filePath: last });
    expect(context.postMessage).toHaveBeenLastCalledWith({ command: 'navigate', path: first });
  });

  it('waits for the unsaved-changes guard before closing tabs to the right', () => {
    const { dispatch, guardUnsavedChanges } = fixture(second, second);
    menuAction('a.md', t.tabContextMenu.closeTabsToRight);
    expect(guardUnsavedChanges).toHaveBeenCalledExactlyOnceWith([second], expect.any(Function));
    expect(dispatch).not.toHaveBeenCalled();
    guardUnsavedChanges.mock.calls[0][1]();
    expect(dispatch.mock.calls.flat()).toEqual([
      { type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: second },
      { type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: html },
      { type: 'ACTIVATE_SPLIT_PANE', paneId: 'primary' },
      { type: 'ACTIVATE_SPLIT_PANE_TAB', paneId: 'primary', filePath: first },
      { type: 'ACTIVATE_CONTENT_TAB', filePath: first },
    ]);
  });

  it('closes other or all tabs within the selected pane only', () => {
    const { dispatch } = fixture();
    menuAction('b.md', t.tabContextMenu.closeOtherTabs);
    expect(dispatch.mock.calls.slice(0, 2).flat()).toEqual([
      { type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: first },
      { type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: html },
    ]);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'ACTIVATE_CONTENT_TAB', filePath: second });
    dispatch.mockClear();
    menuAction('a.md', t.tabContextMenu.closeAllTabs);
    expect(dispatch.mock.calls.flat()).toEqual([first, second, html].map((filePath) => ({
      type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath,
    })));
    expect(context.postMessage).toHaveBeenLastCalledWith({ command: 'navigate', path: last });
  });

  it('guards replacement of a dirty opposite pane and opens a secondary tab in the primary pane', () => {
    const { dispatch, guardUnsavedChanges, openInSplit } = fixture(second, last);
    menuAction('a.md', /open in split/i);
    expect(guardUnsavedChanges).toHaveBeenCalledExactlyOnceWith([last], expect.any(Function));
    expect(openInSplit).not.toHaveBeenCalled();
    guardUnsavedChanges.mock.calls[0][1]();
    expect(openInSplit).toHaveBeenCalledExactlyOnceWith(first);
    menuAction('d.md', /open in split/i);
    expect(dispatch.mock.calls.flat()).toEqual([
      { type: 'SET_SPLIT_PANE_FILE', paneId: 'primary', filePath: last },
      { type: 'ACTIVATE_SPLIT_PANE', paneId: 'primary' },
    ]);
  });

  it('opens HTML preview, system browser, file location and revision history', () => {
    const { setContentTabHtmlPreview } = fixture();
    menuAction('c.html', t.showHtmlPreview);
    expect(setContentTabHtmlPreview).toHaveBeenCalledExactlyOnceWith(html, true);
    menuAction('c.html', t.openInBrowser);
    expect(context.postMessage).toHaveBeenCalledWith({ command: 'openExternal', url: 'file:///docs/c.html' });
    menuAction('c.html', t.tabContextMenu.showInFileManager);
    expect(context.postMessage).toHaveBeenCalledWith({ command: 'openShellLocation', mode: 'open-parent-directory', path: html });
    const history = vi.fn();
    window.addEventListener(DOCUMENT_HISTORY_OPEN_EVENT, history, { once: true });
    try {
      menuAction('c.html', /revision/i);
      expect(history).toHaveBeenCalledWith(expect.objectContaining({ detail: { filePath: html } }));
    } finally {
      window.removeEventListener(DOCUMENT_HISTORY_OPEN_EVENT, history);
    }
  });

  it('exposes swap and close split from a pane header rather than individual tabs', () => {
    const { swapSplitPanes, closeSplitView } = fixture();
    const pane = screen.getByRole('region', { name: /secondary document/i });
    const header = pane.querySelector('.split-document-pane__header')!;
    fireEvent.contextMenu(header);
    fireEvent.click(screen.getByRole('menuitem', { name: /swap panes/i }));
    fireEvent.contextMenu(header);
    fireEvent.click(screen.getByRole('menuitem', { name: /close split/i }));
    expect(swapSplitPanes).toHaveBeenCalledOnce();
    expect(closeSplitView).toHaveBeenCalledOnce();
  });

  it('uses a cached HTML tab override instead of the default preview setting', () => {
    const { setContentTabHtmlPreview } = fixture(html, undefined, {
      contentTabs: [{ filePath: html, fileName: 'c.html', relativePath: 'c.html', title: 'c.html', htmlPreviewOverride: true }],
    });
    menuAction('c.html', t.showMarkdownView);
    expect(setContentTabHtmlPreview).toHaveBeenCalledExactlyOnceWith(html, false);
  });

  it('does not navigate when closing tabs to the right leaves the active tab in place', () => {
    const { dispatch } = fixture(first);
    menuAction('a.md', t.tabContextMenu.closeTabsToRight);
    expect(dispatch.mock.calls.flat()).toEqual([
      { type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: second },
      { type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: html },
    ]);
    expect(context.postMessage).not.toHaveBeenCalled();
  });

  it('navigates without dispatching a document activation for a pane tab that has not been cached', () => {
    const split = createSplitViewState(first);
    const { dispatch } = fixture(second, undefined, {
      contentTabs: [{ filePath: second, fileName: 'b.md', relativePath: 'b.md', title: 'B' }],
      splitView: {
        ...split, enabled: true,
        primary: { ...split.primary, tabs: [first, second], activeTabPath: second, filePath: second },
      },
    });
    fireEvent.click(tab('a.md'));
    expect(dispatch.mock.calls.flat()).toEqual([
      { type: 'ACTIVATE_SPLIT_PANE', paneId: 'primary' },
      { type: 'ACTIVATE_SPLIT_PANE_TAB', paneId: 'primary', filePath: first },
    ]);
    expect(context.postMessage).toHaveBeenCalledExactlyOnceWith({ command: 'navigate', path: first });
  });

  it.each([
    ['a cached file with a fragment', '/DOCS/A.md#start', first, { type: 'ACTIVATE_CONTENT_TAB', filePath: first }],
    ['an uncached file', '/docs/new.md', '/docs/new.md', { type: 'SET_LOADING' }],
  ])('opens %s dropped onto the secondary pane', (_name, filePath, resolvedPath, action) => {
    const { dispatch } = fixture();
    const target = screen.getByTestId('split-pane-scroll-secondary');
    const original = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => target });
    const source = document.createElement('div');
    document.body.appendChild(source);
    try {
      beginSplitPointerDrag({ button: 0, clientX: 0, clientY: 5 }, { kind: 'document', filePath }, { label: filePath, source });
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 90, clientY: 5, bubbles: true }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 90, clientY: 5, bubbles: true }));
      expect(dispatch.mock.calls.flat()).toEqual([
        { type: 'ACTIVATE_SPLIT_PANE', paneId: 'secondary' },
        { type: 'SET_SPLIT_PANE_FILE', paneId: 'secondary', filePath: resolvedPath, targetIndex: undefined },
        action,
      ]);
      expect(context.postMessage).toHaveBeenLastCalledWith({ command: 'navigate', path: resolvedPath });
    } finally {
      source.remove();
      if (original) Object.defineProperty(document, 'elementFromPoint', original);
      else Reflect.deleteProperty(document, 'elementFromPoint');
    }
  });
});
