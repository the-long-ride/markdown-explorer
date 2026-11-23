import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState, type AppState } from '../../../../ui/src/contexts/appStateModel';
import { createEditableDocumentSession, documentSessionKey } from '../../../../ui/src/editor/documentSession';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';
import { SplitContentView } from '../../../../ui/src/components/Content/SplitContent';
import { SplitPaneView } from '../../../../ui/src/components/Content/SplitPaneView';
import { endDragSession } from '../../../../ui/src/components/Content/documentFileDrop';
import { selectPaneDocument } from '../../../../ui/src/split-view/paneSelectors';
import { getHistoryTranslations } from '../../../../ui/src/contexts/historyTranslations';
import { getEditorUiTranslations } from '../../../../ui/src/contexts/editorUiTranslations';
import { getSplitViewTranslations } from '../../../../ui/src/contexts/splitViewTranslations';

const tab = {
  filePath: '/docs/a.md',
  relativePath: 'a.md',
  fileName: 'a.md',
  title: 'A',
  contentHtml: '<h1>edited</h1>',
  markdownSource: '# edited',
  sourceDocumentText: '# A',
  frontmatter: {},
  toc: [],
  previewInfo: null,
  documentWrite: { supported: true, revision: '1:3' },
} as const;

function fixtureState() {
  const session = { ...createEditableDocumentSession('/docs/a.md', '# A', '1:3'), source: '# edited' };
  const split = createSplitViewState('/docs/a.md');
  return {
    ...initialState,
    settings: { ...initialState.settings, language: 'en', markdownEditingEnabled: true, fileTabs: true },
    contentTabs: [tab],
    documentSessions: { [documentSessionKey('/docs/a.md')]: session },
    splitView: {
      ...split,
      enabled: true,
      activePane: 'primary' as const,
      primary: { ...split.primary, filePath: '/docs/a.md', tabs: ['/docs/a.md'], activeTabPath: '/docs/a.md', mode: 'plain' as const, scrollTop: 100 },
      secondary: { ...split.secondary, filePath: '/docs/a.md', tabs: ['/docs/a.md'], activeTabPath: '/docs/a.md', mode: 'rendered' as const, scrollTop: 450 },
    },
  };
}

function twoDocumentState(): AppState {
  return {
    ...initialState,
    settings: { ...initialState.settings, fileTabs: true, language: 'en' },
    contentTabs: [
      { filePath: '/docs/a.md', fileName: 'a.md', relativePath: 'a.md', title: 'A' },
      { filePath: '/docs/b.md', fileName: 'b.md', relativePath: 'b.md', title: 'B' },
    ],
    splitView: {
      ...createSplitViewState('/docs/a.md'),
      enabled: true,
      primary: { ...createSplitViewState('/docs/a.md').primary, filePath: '/docs/a.md', tabs: ['/docs/a.md'], activeTabPath: '/docs/a.md' },
      secondary: { ...createSplitViewState('/docs/a.md').secondary, filePath: '/docs/b.md', tabs: ['/docs/b.md'], activeTabPath: '/docs/b.md' },
    },
  } as AppState;
}

afterEach(() => {
  endDragSession();
  vi.useRealTimers();
});

describe('SplitContentView', () => {
  it('keeps revision and diff controls in the pane and returns to the current document', () => {
    const dir = getSplitViewTranslations('en');
    const history = getHistoryTranslations('en');
    const editor = getEditorUiTranslations('en');
    const projection = selectPaneDocument(fixtureState(), 'primary')!;
    const revision = { oid: 'abc123456', path: 'a.md', source: '# Archived text' };
    const comparison = { leftSource: 'old text', rightSource: 'new text' };
    const props = {
      paneId: 'primary' as const, paneTabs: ['/docs/a.md'], activeTabPath: '/docs/a.md',
      tabLabels: new Map([['/docs/a.md', 'A']]), showTabs: false, language: 'en',
      documentRenderRevision: 1, editingEnabled: false, clearHistoryView: vi.fn(),
      onModeChange: vi.fn(), onSourceChange: vi.fn(), onSave: vi.fn(), onScrollChange: vi.fn(),
      onHeaderContextMenu: vi.fn(),
    };
    const historyView = { filePath: projection.filePath, mode: 'git-revision' as const, revision };
    const { rerender } = render(<SplitPaneView {...props} projection={{ ...projection, title: '', mode: 'git-revision' }} historyView={historyView} />);
    expect(screen.getByText('a.md', { selector: '.split-document-pane__title' })).toHaveAttribute('data-hover-tooltip', '/docs/a.md');
    expect(screen.getByRole('heading', { name: 'Archived text' })).toBeInTheDocument();
    const resume = screen.getByRole('button', { name: `${dir.primaryDocument} ${editor.rendered}` });
    const revisionMode = screen.getByRole('button', { name: `${dir.primaryDocument} ${history.revision}` });
    expect(revisionMode).toHaveAttribute('aria-pressed', 'true');
    fireEvent.contextMenu(revisionMode);
    expect(props.onHeaderContextMenu).not.toHaveBeenCalled();
    fireEvent.click(resume);
    fireEvent.click(screen.getByRole('button', { name: history.returnCurrent }));
    expect(props.clearHistoryView.mock.calls).toEqual([['primary'], ['primary']]);
    expect(props.onModeChange).not.toHaveBeenCalled();

    rerender(<SplitPaneView {...props} projection={{ ...projection, mode: 'diff' }} historyView={{ filePath: projection.filePath, mode: 'diff', comparison }} />);
    expect(screen.getByTestId('document-diff-view')).toHaveTextContent('old text');
    expect(screen.getByTestId('document-diff-view')).toHaveTextContent('new text');
    fireEvent.click(screen.getByRole('button', { name: history.returnCurrent }));
    expect(props.clearHistoryView).toHaveBeenCalledTimes(3);

    rerender(<SplitPaneView {...props} projection={{ ...projection, mode: 'rendered' }} historyView={historyView} />);
    expect(screen.queryByTestId('document-diff-view')).not.toBeInTheDocument();
    const openRevision = screen.getByRole('button', { name: `${dir.primaryDocument} ${history.revision}` });
    expect(openRevision).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(openRevision);
    expect(props.onModeChange).toHaveBeenCalledExactlyOnceWith('primary', 'git-revision');
    rerender(<SplitPaneView {...props} projection={projection} />);
    expect(screen.queryByRole('textbox', { name: /markdown source/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'edited' })).toBeInTheDocument();
  });

  it('renders independent modes for one shared source', () => {
    render(
      <SplitContentView
        state={fixtureState()}
        onActivatePane={vi.fn()}
        onRatioChange={vi.fn()}
        onCloseSplit={vi.fn()}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
        onScrollChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('textbox', { name: /markdown source/i })).toHaveTextContent('# edited');
    expect(screen.getByRole('region', { name: /secondary document/i })).toHaveTextContent('edited');
  });

  it('shows view-mode buttons only for Markdown and MDX documents', () => {
    const base = twoDocumentState();
    const state = {
      ...base,
      settings: { ...base.settings, markdownEditingEnabled: true },
      contentTabs: [
        base.contentTabs[0],
        { filePath: '/docs/notes.txt', fileName: 'notes.txt', relativePath: 'notes.txt', title: 'Notes' },
      ],
      splitView: {
        ...base.splitView,
        secondary: { ...base.splitView.secondary, filePath: '/docs/notes.txt', tabs: ['/docs/notes.txt'], activeTabPath: '/docs/notes.txt' },
      },
    } as AppState;
    const { container } = render(
      <SplitContentView
        state={state}
        onActivatePane={vi.fn()}
        onRatioChange={vi.fn()}
        onCloseSplit={vi.fn()}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
        onScrollChange={vi.fn()}
      />,
    );

    const groups = container.querySelectorAll('.split-document-pane__modes');
    expect(groups).toHaveLength(1);
    expect(screen.getByRole('region', { name: /primary document/i }).querySelector('.split-document-pane__modes')).not.toBeNull();
    expect(screen.getByRole('region', { name: /secondary document/i }).querySelector('.split-document-pane__modes')).toBeNull();
  });

  it('does not dispatch global scroll state on every scroll event', () => {
    vi.useFakeTimers();
    const onScrollChange = vi.fn();
    render(
      <SplitContentView
        state={fixtureState()}
        onActivatePane={vi.fn()}
        onRatioChange={vi.fn()}
        onCloseSplit={vi.fn()}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
        onScrollChange={onScrollChange}
      />,
    );

    const secondaryScroll = screen.getByTestId('split-pane-scroll-secondary');
    Object.defineProperty(secondaryScroll, 'scrollTop', { configurable: true, writable: true, value: 512 });
    fireEvent.scroll(secondaryScroll);
    secondaryScroll.scrollTop = 640;
    fireEvent.scroll(secondaryScroll);
    expect(onScrollChange).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(250); });
    expect(onScrollChange).toHaveBeenCalledTimes(1);
    expect(onScrollChange).toHaveBeenCalledWith('secondary', 640);
  });

  it('renders a separate document-tab strip for each pane when file tabs are enabled', () => {
    render(
      <SplitContentView
        state={fixtureState()}
        onActivatePane={vi.fn()}
        onRatioChange={vi.fn()}
        onCloseSplit={vi.fn()}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
        onScrollChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('tablist')).toHaveLength(2);
    expect(screen.getAllByRole('tab', { name: 'A' })).toHaveLength(2);
  });

  it('renders tabs with normal content-tab CSS classes and handles context menu', () => {
    const onTabContextMenuAction = vi.fn();
    const base = fixtureState();
    const state = {
      ...base,
      splitView: {
        ...base.splitView,
        secondary: {
          ...base.splitView.secondary,
          filePath: '/docs/b.md',
          activeTabPath: '/docs/b.md',
          tabs: ['/docs/b.md'],
        },
      },
    };
    render(
      <SplitContentView
        state={state}
        onActivatePane={vi.fn()}
        onRatioChange={vi.fn()}
        onCloseSplit={vi.fn()}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
        onScrollChange={vi.fn()}
        onTabContextMenuAction={onTabContextMenuAction}
      />,
    );

    const primaryTab = screen.getByRole('tab', { name: 'A' });
    expect(primaryTab).toHaveClass('content-tab');
    expect(primaryTab).toHaveClass('is-active');

    // Right-click on the tab to open context menu
    fireEvent.contextMenu(primaryTab, { clientX: 100, clientY: 50 });

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();

    
    const openInSplitItem = screen.getByRole('menuitem', { name: /open in split/i });
    expect(openInSplitItem).toBeInTheDocument();
    expect(openInSplitItem).not.toBeDisabled();

    // Verify removed menu items: Swap panes, Move to other pane, Close split
    expect(screen.queryByRole('menuitem', { name: /swap panes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /move to other pane/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /close split/i })).not.toBeInTheDocument();

    fireEvent.click(openInSplitItem);
    expect(onTabContextMenuAction).toHaveBeenCalledWith('openInSplit', 'primary', '/docs/a.md');
  });

  it('offers swap and close split from the header context menu', () => {
    const onTabContextMenuAction = vi.fn();
    render(
      <SplitContentView
        state={twoDocumentState()}
        onActivatePane={vi.fn()}
        onRatioChange={vi.fn()}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onSave={vi.fn()}
        onScrollChange={vi.fn()}
        onTabContextMenuAction={onTabContextMenuAction}
      />,
    );

    const headers = document.querySelectorAll<HTMLElement>('.split-document-pane__header');
    fireEvent.contextMenu(headers[1], { clientX: 20, clientY: 20 });
    expect(screen.getByRole('menuitem', { name: /close split/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /swap panes/i }));

    expect(onTabContextMenuAction).toHaveBeenCalledWith('swapPanes', 'secondary', '/docs/b.md');
  });
});
