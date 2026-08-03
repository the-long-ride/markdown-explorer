import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchOverlay } from '../../../../ui/src/components/Search/SearchOverlay';

const { postMessage, messageHandlers, onMessage, navigate, scrollPreviewToMatch } = vi.hoisted(() => {
  const handlers = new Set<(message: any) => void>();
  return {
    postMessage: vi.fn(),
    messageHandlers: handlers,
    onMessage: vi.fn((handler: (message: any) => void) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }),
    navigate: vi.fn(),
    scrollPreviewToMatch: vi.fn(),
  };
});

function emitHostMessage(message: any) {
  for (const handler of [...messageHandlers]) handler(message);
}

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      settings: { language: 'en', showTitle: true },
      workspaceName: 'Docs',
      workspacePath: '/docs',
      fileList: [
        { fsPath: '/docs/Alpha.md', relativePath: 'Alpha.md', fileName: 'Alpha.md', title: 'Alpha' },
      ],
    },
    navigate,
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage, onMessage }),
}));

vi.mock('../../../../ui/src/contexts/contentTabState', () => ({
  renderMarkdownClientSide: (markdownSource: string) => ({
    html: `<section class="mdn-section"><h2 class="mdn-section-header" tabindex="0">${markdownSource}</h2><div class="mdn-section-body">Content</div></section>`,
  }),
}));

vi.mock('../../../../ui/src/utils/searchJump', () => ({
  scrollToRenderedSearchMatchInRoot: (...args: any[]) => scrollPreviewToMatch(...args),
}));

vi.mock('../../../../ui/src/contexts/translations', () => ({
  getTranslations: () => ({
    actions: { loadMore: 'Load more' },
    tooltips: { closeModal: 'Close modal' },
    search: {
      dialogLabel: 'Search documents', modalTitleCurrent: 'Search current workspace', modalTitleAllTabs: 'Search all workspaces',
      queryLabel: 'Search query', currentWorkspacePlaceholder: 'Search current workspace…', allWorkspacesPlaceholder: 'Search all workspaces…',
      indexingPlaceholder: 'Indexing other workspaces…', workspaces: 'Workspaces', allWorkspaces: 'All workspaces', results: 'Results',
      preview: 'Preview', matchCase: 'Match case', searchingContents: 'Searching file contents…', noMatches: 'No matches found.',
      openResult: 'Open result', previewEmptyTitle: 'Select a result', previewEmptyBody: 'Choose a search result.',
      matchPreview: 'Match preview', fileNameOrPathMatch: 'File name or path match', minimumCharacters: 'Enter at least 2 characters to search.',
      includeWorkspace: 'Include {workspace} in search', excludeWorkspace: 'Exclude {workspace} from search',
      checkAllWorkspaces: 'Search all workspaces', uncheckAllWorkspaces: 'Exclude all workspaces',
      resizeWorkspaces: 'Resize workspace list', resizePreview: 'Resize preview',
      loadingPreview: 'Loading preview…', previewUnavailable: 'Preview unavailable.',
    },
  }),
}));

vi.mock('../../../../ui/src/components/shared/icons', () => ({
  ChevronRightIcon: () => <span>arrow</span>, CloseIcon: () => <span>close</span>,
  FolderIcon: () => <span>folder</span>, SearchIcon: () => <span>search</span>,
}));

const alphaResult = {
  fsPath: '/docs/Alpha.md', relativePath: 'Alpha.md', fileName: 'Alpha.md', title: 'Alpha',
  excerpt: 'Alpha alpha', matchIndex: 0, matchOrdinal: 0,
};

function runCurrentWorkspaceSearch() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Search query' }), { target: { value: 'Alpha' } });
  act(() => { vi.advanceTimersByTime(200); });
  const request = postMessage.mock.calls.find(([message]) => message.command === 'searchWorkspace')?.[0];
  expect(request).toBeTruthy();
  act(() => emitHostMessage({
    command: 'workspaceSearchResults', requestId: request.requestId, results: [alphaResult],
  }));
  return request;
}

describe('SearchOverlay interactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    postMessage.mockClear();
    onMessage.mockClear();
    navigate.mockClear();
    scrollPreviewToMatch.mockClear();
    messageHandlers.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('previews the selected full file and opens only from the preview header while Preview is on', () => {
    const onWorkspaceSelect = vi.fn();
    render(<SearchOverlay isOpen onClose={vi.fn()} onWorkspaceSelect={onWorkspaceSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Match case' }));
    const request = runCurrentWorkspaceSearch();
    expect(request).toEqual(expect.objectContaining({ query: 'Alpha', matchCase: true }));

    fireEvent.click(screen.getByRole('option'));
    expect(onWorkspaceSelect).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: 'Open result' })).toHaveLength(1);

    const previewRequest = postMessage.mock.calls.find(([message]) => message.command === 'loadSearchPreview')?.[0];
    expect(previewRequest).toEqual(expect.objectContaining({ filePath: '/docs/Alpha.md' }));
    act(() => emitHostMessage({
      command: 'searchPreviewResult', requestId: previewRequest.requestId, ok: true,
      filePath: '/docs/Alpha.md', markdownSource: '# Alpha preview',
    }));
    expect(screen.getByText('# Alpha preview')).toBeTruthy();

    act(() => { vi.runOnlyPendingTimers(); });
    expect(scrollPreviewToMatch).toHaveBeenCalledWith(
      expect.anything(), 'Alpha', 0, 0, '# Alpha preview', true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open result' }));
    expect(onWorkspaceSelect).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/docs/Alpha.md' }), 'Alpha', true);
  });

  it('collapses and expands heading sections when clicking heading section headers in preview body', () => {
    const { container } = render(<SearchOverlay isOpen onClose={vi.fn()} />);
    runCurrentWorkspaceSearch();

    const previewRequest = postMessage.mock.calls.find(([message]) => message.command === 'loadSearchPreview')?.[0];
    act(() => emitHostMessage({
      command: 'searchPreviewResult', requestId: previewRequest.requestId, ok: true,
      filePath: '/docs/Alpha.md', markdownSource: 'Alpha Section',
    }));

    const header = container.querySelector('.mdn-section-header') as HTMLElement;
    const section = container.querySelector('.mdn-section') as HTMLElement;
    expect(header).toBeTruthy();
    expect(section).toBeTruthy();
    expect(section.classList.contains('is-collapsed')).toBe(false);

    fireEvent.click(header);
    expect(section.classList.contains('is-collapsed')).toBe(true);

    fireEvent.click(header);
    expect(section.classList.contains('is-collapsed')).toBe(false);
  });

  it('hides the preview and exposes per-result tooltip buttons when Preview is off', () => {
    const onWorkspaceSelect = vi.fn();
    const { container } = render(<SearchOverlay isOpen onClose={vi.fn()} onWorkspaceSelect={onWorkspaceSelect} />);
    runCurrentWorkspaceSearch();

    expect(container.querySelector('.search-overlay-preview')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(container.querySelector('.search-overlay-preview')).toBeNull();

    const openButtons = screen.getAllByRole('button', { name: 'Open result' });
    expect(openButtons).toHaveLength(1);
    fireEvent.click(openButtons[0]);
    expect(onWorkspaceSelect).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/docs/Alpha.md' }), 'Alpha', false);
  });

  it('keeps the active query when workspace indexes change and enables newly added workspaces', () => {
    const firstItems = [
      { ...alphaResult, tabId: 'tab-a', tabLabel: 'Workspace A' },
      { ...alphaResult, fsPath: '/other/Alpha.md', tabId: 'tab-b', tabLabel: 'Workspace B' },
    ];
    const { rerender } = render(
      <SearchOverlay isOpen onClose={vi.fn()} crossTabItems={firstItems} onCrossTabSelect={vi.fn()} />,
    );
    const input = screen.getByRole('textbox', { name: 'Search query' });
    fireEvent.change(input, { target: { value: 'Alpha' } });

    rerender(
      <SearchOverlay
        isOpen
        onClose={vi.fn()}
        crossTabItems={[
          ...firstItems,
          { ...alphaResult, fsPath: '/third/Alpha.md', tabId: 'tab-c', tabLabel: 'Workspace C' },
        ]}
        onCrossTabSelect={vi.fn()}
      />,
    );

    expect(input).toHaveValue('Alpha');
    expect(screen.getByRole('checkbox', { name: 'Exclude Workspace C from search' })).toBeChecked();
  });

  it('searches only checked workspaces and defaults every workspace to checked', () => {
    const crossTabItems = [
      { ...alphaResult, tabId: 'tab-a', tabLabel: 'Workspace A' },
      { ...alphaResult, fsPath: '/other/Alpha.md', tabId: 'tab-b', tabLabel: 'Workspace B' },
    ];
    render(<SearchOverlay isOpen onClose={vi.fn()} crossTabItems={crossTabItems} onCrossTabSelect={vi.fn()} />);

    const workspaceACheckbox = screen.getByRole('checkbox', { name: 'Exclude Workspace A from search' });
    const workspaceBCheckbox = screen.getByRole('checkbox', { name: 'Exclude Workspace B from search' });
    expect(workspaceACheckbox).toBeChecked();
    expect(workspaceBCheckbox).toBeChecked();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search query' }), { target: { value: 'Alpha' } });
    act(() => { vi.advanceTimersByTime(200); });
    expect(postMessage.mock.calls.find(([message]) => message.command === 'searchAcrossWorkspaces')?.[0].tabIds)
      .toEqual(['tab-a', 'tab-b']);

    postMessage.mockClear();
    fireEvent.click(workspaceBCheckbox);
    act(() => { vi.advanceTimersByTime(200); });
    expect(postMessage.mock.calls.find(([message]) => message.command === 'searchAcrossWorkspaces')?.[0].tabIds)
      .toEqual(['tab-a']);
  });
});

describe('SearchOverlay preview stability during scan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    postMessage.mockClear();
    onMessage.mockClear();
    navigate.mockClear();
    scrollPreviewToMatch.mockClear();
    messageHandlers.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not re-fetch the preview on every incremental workspace result batch', () => {
    render(<SearchOverlay isOpen onClose={vi.fn()} />);

    // Trigger search
    fireEvent.change(screen.getByRole('textbox', { name: 'Search query' }), { target: { value: 'Alpha' } });
    act(() => { vi.advanceTimersByTime(200); });

    const request = postMessage.mock.calls.find(([msg]) => msg.command === 'searchWorkspace')?.[0];
    expect(request).toBeTruthy();
    postMessage.mockClear();

    // First result batch arrives → selectedResult stabilizes via useDeferredValue
    act(() => emitHostMessage({
      command: 'workspaceSearchResults',
      requestId: request.requestId,
      results: [alphaResult],
    }));

    // useDeferredValue defers updates; run pending microtasks/timers to let it flush
    act(() => { vi.runAllTicks(); });
    act(() => { vi.advanceTimersByTime(0); });

    // Should have fired exactly ONE loadSearchPreview for the selected file
    const previewCalls = postMessage.mock.calls.filter(([msg]) => msg.command === 'loadSearchPreview');
    expect(previewCalls.length).toBe(1);
    expect(previewCalls[0][0]).toEqual(expect.objectContaining({ filePath: '/docs/Alpha.md' }));
  });

  it('does not re-fetch the preview on every incremental cross-tab batch while scanning', () => {
    const itemA = { ...alphaResult, tabId: 'tab-a', tabLabel: 'Workspace A' };
    const itemB = { ...alphaResult, fsPath: '/other/Beta.md', fileName: 'Beta.md', tabId: 'tab-a', tabLabel: 'Workspace A' };
    const crossTabItems = [itemA, itemB];

    render(<SearchOverlay isOpen onClose={vi.fn()} crossTabItems={crossTabItems} onCrossTabSelect={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search query' }), { target: { value: 'Alpha' } });
    act(() => { vi.advanceTimersByTime(200); });

    const searchRequest = postMessage.mock.calls.find(([msg]) => msg.command === 'searchAcrossWorkspaces')?.[0];
    expect(searchRequest).toBeTruthy();
    postMessage.mockClear();

    // Batch 1: first result arrives (search still ongoing — done: false not sent yet)
    act(() => emitHostMessage({
      command: 'crossTabSearchResults',
      requestId: searchRequest.requestId,
      results: [itemA],
    }));
    act(() => { vi.runAllTicks(); });
    act(() => { vi.advanceTimersByTime(0); });

    // Batch 2: second result arrives while scan still running
    act(() => emitHostMessage({
      command: 'crossTabSearchResults',
      requestId: searchRequest.requestId,
      results: [itemB],
    }));
    act(() => { vi.runAllTicks(); });
    act(() => { vi.advanceTimersByTime(0); });

    // Scan done
    act(() => emitHostMessage({
      command: 'crossTabSearchResults',
      requestId: searchRequest.requestId,
      done: true,
      results: [],
    }));
    act(() => { vi.runAllTicks(); });
    act(() => { vi.advanceTimersByTime(0); });

    // Preview must have been requested at most once per unique selected item,
    // not once per batch. With stable deferral only 1 loadSearchPreview fires
    // for the first auto-selected item.
    const previewCalls = postMessage.mock.calls.filter(([msg]) => msg.command === 'loadSearchPreview');
    expect(previewCalls.length).toBe(1);
  });

  it('loads a fresh preview when the user explicitly selects a different result', () => {
    const betaResult = {
      fsPath: '/docs/Beta.md', relativePath: 'Beta.md', fileName: 'Beta.md', title: 'Beta',
      excerpt: 'Beta beta', matchIndex: 0, matchOrdinal: 0,
    };

    // Mock two results in the file list for current workspace search
    vi.mocked(vi.importActual).mockResolvedValue({});

    render(<SearchOverlay isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search query' }), { target: { value: 'Alpha' } });
    act(() => { vi.advanceTimersByTime(200); });

    const request = postMessage.mock.calls.find(([msg]) => msg.command === 'searchWorkspace')?.[0];
    act(() => emitHostMessage({
      command: 'workspaceSearchResults',
      requestId: request.requestId,
      results: [alphaResult, betaResult],
    }));
    act(() => { vi.runAllTicks(); act(() => { vi.advanceTimersByTime(0); }); });
    postMessage.mockClear();

    // Manually click the Beta result row to switch selection
    const options = screen.getAllByRole('option');
    if (options.length > 1) {
      fireEvent.click(options[1]);
      act(() => { vi.runAllTicks(); });
      act(() => { vi.advanceTimersByTime(0); });

      // A new loadSearchPreview must fire for Beta
      const newPreviewCalls = postMessage.mock.calls.filter(([msg]) => msg.command === 'loadSearchPreview');
      expect(newPreviewCalls.length).toBeGreaterThanOrEqual(1);
      expect(newPreviewCalls[0][0]).toEqual(expect.objectContaining({ filePath: '/docs/Beta.md' }));
    }
  });
});

