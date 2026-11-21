import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useMemo, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMarkdownClientSide } from '../../../../ui/src/contexts/contentTabState';
import { SidebarSearch } from '../../../../ui/src/components/Sidebar/SidebarSearch';
import { SEARCH_JUMP_MARK_CLASS } from '../../../../ui/src/utils/searchJump';
import {
  clearPendingSnapshotSearchJump,
  createRevisionSidebarSearch,
  getPendingSnapshotSearchJump,
  queueSnapshotSearchJump,
  useSnapshotSearchJump,
} from '../../../../ui/src/utils/snapshotSearchJump';
import { useAppSearchEffects } from '../../../../ui/src/useAppSearchEffects';
import { registerDocumentRoot, resetDocumentRoots } from '../../../../ui/src/document/activeDocumentRoot';

const mockReturnToHead = vi.fn();
let mockRepositoryView: { mode: 'live' } | { mode: 'revision'; oid: string; headOid: string } = { mode: 'live' };

const stableAppState = {
  state: {
    settings: { language: 'en', showTitle: false },
    fileList: [],
  },
  navigate: vi.fn(),
};

const stableBridge = {
  postMessage: vi.fn(),
  onMessage: () => () => undefined,
};

vi.mock('../../../../ui/src/contexts/RepositorySnapshotContext', () => ({
  useRepositorySnapshot: () => ({
    repositoryView: mockRepositoryView,
    returnToHead: mockReturnToHead,
  }),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => stableAppState,
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => stableBridge,
}));

const OID = 'a'.repeat(40);
const HEAD_OID = 'h'.repeat(40);

function SnapshotViewerHarness({
  oid,
  activePath,
  source,
}: {
  oid: string | null;
  activePath: string | null;
  source: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMarkdown = Boolean(activePath && /\.mdx?$/i.test(activePath));
  const rendered = useMemo(
    () => (source && activePath && isMarkdown ? renderMarkdownClientSide(source, activePath, false) : null),
    [activePath, isMarkdown, source],
  );

  useSnapshotSearchJump({
    oid,
    activePath,
    source,
    containerRef: scrollRef,
    renderKey: rendered?.html ?? source ?? null,
  });

  return (
    <div ref={scrollRef} className="content__scroll repository-snapshot-content__scroll">
      {!source ? (
        <div role="status">No file</div>
      ) : isMarkdown && rendered ? (
        <article
          className="mdn-body repository-snapshot-content__body"
          dangerouslySetInnerHTML={{ __html: rendered.html }}
        />
      ) : (
        <pre className="repository-snapshot-content__source"><code>{source}</code></pre>
      )}
    </div>
  );
}

describe('snapshot search jump (Git History revision mode)', () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    clearPendingSnapshotSearchJump();
    resetDocumentRoots();
    mockRepositoryView = { mode: 'live' };
    mockReturnToHead.mockClear();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearPendingSnapshotSearchJump();
    resetDocumentRoots();
    document.body.innerHTML = '';
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.useRealTimers();
  });

  it('queues a snapshot jump and scrolls+highlights once the snapshot file loads asynchronously', () => {
    const markdown = [
      '# Snapshot Report',
      '',
      'Intro test line.',
      '',
      '| Channel | Owner | Budget | Spend | Status |',
      '|:--|:--|--:|--:|:--|',
      '| Paid Search | Mina | $150,000 | $142,500 | Active |',
      '| Experiments | Sam | $15,000 | $9,850 | Testing |',
      '',
      'Trailing test note.',
    ].join('\n');

    const { rerender } = render(
      <SnapshotViewerHarness oid={OID} activePath={null} source={null} />,
    );

    act(() => {
      queueSnapshotSearchJump({
        oid: OID,
        relativePath: 'manual-tests/test-general.md',
        query: 'test',
        matchOrdinal: 1,
        matchIndex: markdown.indexOf('Testing'),
        lineNumber: 8,
        excerpt: '| Experiments | Sam | $15,000 | $9,850 | Testing |',
        matchCase: false,
      });
    });

    rerender(
      <SnapshotViewerHarness oid={OID} activePath="manual-tests/test-general.md" source={markdown} />,
    );

    act(() => { vi.advanceTimersByTime(60); });

    const active = document.querySelector<HTMLElement>(`mark.${SEARCH_JUMP_MARK_CLASS}`);
    expect(active).not.toBeNull();
    expect(active?.textContent).toBe('Test');
    expect(active?.closest('tr')?.textContent).toContain('Experiments');
    expect(active?.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(getPendingSnapshotSearchJump()).toBeNull();
  });

  it('jumps immediately on same-file snapshot clicks and handles plain-text snapshot files', () => {
    const plainText = 'Line one alpha\nLine two alpha\nLine three alpha';
    render(<SnapshotViewerHarness oid={OID} activePath="notes/log.txt" source={plainText} />);

    act(() => {
      queueSnapshotSearchJump({
        oid: OID,
        relativePath: 'notes/log.txt',
        query: 'alpha',
        matchOrdinal: 2,
        matchIndex: plainText.lastIndexOf('alpha'),
        lineNumber: 3,
        matchCase: false,
      });
    });

    act(() => { vi.advanceTimersByTime(60); });

    const marks = [...document.querySelectorAll<HTMLElement>('mark')];
    expect(marks).toHaveLength(3);
    expect(marks[2].className).toContain(SEARCH_JUMP_MARK_CLASS);
    expect(marks[2].scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('wires SidebarSearch revision results to queue a jump and avoids reloading the already-active snapshot file', async () => {
    const openSnapshotFile = vi.fn();
    const searchRevision = vi.fn(async () => [{
      fsPath: `revision://${OID}/docs/guide.md`,
      relativePath: 'docs/guide.md',
      fileName: 'guide.md',
      title: 'guide',
      excerpt: '| Experiments | Sam | Testing |',
      matchIndex: 42,
      matchOrdinal: 1, // revisionWorkspace produces 1-based ordinals
      matchLength: 4,
      lineNumber: 12,
    }]);

    const revisionSearch = createRevisionSidebarSearch(
      { mode: 'revision', oid: OID, headOid: HEAD_OID },
      'docs/guide.md',
      searchRevision,
      openSnapshotFile,
    );

    render(<SidebarSearch isVisible={true} revisionSearch={revisionSearch} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    const row = document.querySelector<HTMLElement>('.tree-file-search-match-row');
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    expect(openSnapshotFile).not.toHaveBeenCalled();
    expect(getPendingSnapshotSearchJump()).toMatchObject({
      oid: OID,
      relativePath: 'docs/guide.md',
      query: 'test',
      matchOrdinal: 0,
      matchIndex: 42,
      lineNumber: 12,
    });
  });

  it('calls openSnapshotFile when clicking a revision result for a different file', () => {
    const openSnapshotFile = vi.fn();
    const revisionSearch = createRevisionSidebarSearch(
      { mode: 'revision', oid: OID, headOid: HEAD_OID },
      'docs/other.md',
      vi.fn(async () => []),
      openSnapshotFile,
    );

    revisionSearch!.openResult!(
      {
        fsPath: `revision://${OID}/docs/guide.md`,
        relativePath: 'docs/guide.md',
        fileName: 'guide.md',
        title: 'guide',
        excerpt: '# Guide',
        matchIndex: 2,
        matchOrdinal: 2,
        lineNumber: 1,
      },
      'Guide',
      true,
    );

    expect(openSnapshotFile).toHaveBeenCalledWith('docs/guide.md');
    expect(getPendingSnapshotSearchJump()).toMatchObject({
      oid: OID,
      relativePath: 'docs/guide.md',
      query: 'Guide',
      matchOrdinal: 1,
      matchCase: true,
      lineNumber: 1,
    });
  });

  it('keeps revisionSearch referentially stable across active snapshot file changes without re-running commit search', async () => {
    let activePath: string | null = 'docs/first.md';
    const openSnapshotFile = vi.fn((nextPath: string) => {
      activePath = null;
      activePath = nextPath;
    });
    const searchRevision = vi.fn(async () => [
      {
        fsPath: `revision://${OID}/docs/second.md`,
        relativePath: 'docs/second.md',
        fileName: 'second.md',
        title: 'second',
        excerpt: 'Second match line',
        matchIndex: 0,
        matchOrdinal: 1,
        matchLength: 6,
        lineNumber: 1,
      },
    ]);

    const revisionSearch = createRevisionSidebarSearch(
      { mode: 'revision', oid: OID, headOid: HEAD_OID },
      () => activePath,
      searchRevision,
      openSnapshotFile,
    );

    const { rerender } = render(<SidebarSearch isVisible={true} revisionSearch={revisionSearch} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Second' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(searchRevision).toHaveBeenCalledTimes(1);

    const row = document.querySelector<HTMLElement>('.tree-file-search-match-row');
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    // First click loads docs/second.md; re-rendering with the same revisionSearch keeps results and does not re-search.
    expect(openSnapshotFile).toHaveBeenCalledTimes(1);
    expect(openSnapshotFile).toHaveBeenCalledWith('docs/second.md');
    rerender(<SidebarSearch isVisible={true} revisionSearch={revisionSearch} />);
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(searchRevision).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.tree-file-search-match-row')).toHaveLength(1);

    // Clicking again now sees updated activePath via getter and avoids reloading docs/second.md.
    fireEvent.click(document.querySelector<HTMLElement>('.tree-file-search-match-row')!);
    expect(openSnapshotFile).toHaveBeenCalledTimes(1);
  });
});

describe('useAppSearchEffects live & revision-mode coordination', () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    resetDocumentRoots();
    mockRepositoryView = { mode: 'live' };
    mockReturnToHead.mockClear();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetDocumentRoots();
    document.body.innerHTML = '';
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.useRealTimers();
  });

  it('exits revision mode when selecting a live workspace result and skips redundant navigate on same live file', () => {
    mockRepositoryView = { mode: 'revision', oid: OID, headOid: HEAD_OID };
    const navigate = vi.fn();
    const bridge = { onMessage: () => () => undefined, postMessage: vi.fn() };

    const { result } = renderHook(() => {
      const [pending, setPending] = useState<any>(null);
      const effects = useAppSearchEffects({
        bridge,
        state: {
          currentFile: 'D:\\Repo\\docs\\test.md',
          contentHtml: '<p>Hello</p>',
          markdownSource: 'Hello',
          isLoading: false,
          renderVersion: 1,
          sidebarCollapsed: false,
        },
        pendingSearchJump: pending,
        setPendingSearchJump: setPending,
        setIsFullscreen: vi.fn(),
        navigate,
        tabs: [],
        activateTab: vi.fn(),
        toggleSidebar: vi.fn(),
        dispatch: vi.fn(),
      });
      return { pending, effects };
    });

    act(() => {
      result.current.effects.handleWorkspaceSearchSelect(
        { fsPath: 'd:/repo/docs/test.md', matchOrdinal: 0, matchIndex: 0, lineNumber: 1, excerpt: 'Hello' },
        'Hello',
        false,
      );
    });

    expect(mockReturnToHead).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.pending).toMatchObject({
      filePath: 'd:/repo/docs/test.md',
      query: 'Hello',
      lineNumber: 1,
    });
  });

  it('waits while loading and re-applies search jump if a cached-tab background renderVersion bump wipes marks', () => {
    const markdown = '# Heading\n\nAlpha target word.';
    const rendered = renderMarkdownClientSide(markdown, 'D:\\Repo\\doc.md', false);
    const body = document.createElement('div');
    body.id = 'mdBody';
    body.innerHTML = rendered.html;
    document.body.appendChild(body);
    const unregister = registerDocumentRoot({
      id: 'main',
      body,
      scroll: null,
      filePath: 'D:\\Repo\\doc.md',
      markdownSource: markdown,
    });

    const bridge = { onMessage: () => () => undefined, postMessage: vi.fn() };
    const { result, rerender } = renderHook(
      ({ isLoading, renderVersion }: { isLoading: boolean; renderVersion: number }) => {
        const [pending, setPending] = useState<any>(null);
        const effects = useAppSearchEffects({
          bridge,
          state: {
            currentFile: 'D:\\Repo\\doc.md',
            contentHtml: rendered.html,
            markdownSource: markdown,
            isLoading,
            renderVersion,
            sidebarCollapsed: false,
          },
          pendingSearchJump: pending,
          setPendingSearchJump: setPending,
          setIsFullscreen: vi.fn(),
          navigate: vi.fn(),
          tabs: [],
          activateTab: vi.fn(),
          toggleSidebar: vi.fn(),
          dispatch: vi.fn(),
        });
        return { pending, effects };
      },
      { initialProps: { isLoading: true, renderVersion: 1 } },
    );

    act(() => {
      result.current.effects.queueSearchJump('d:/repo/doc.md', 'target', 0, markdown.indexOf('target'), false, undefined, 3);
    });

    // While loading, jump must stay queued and not burn retries.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.pending).not.toBeNull();
    expect(body.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)).toBeNull();

    // Once loaded, jump executes and marks the match.
    rerender({ isLoading: false, renderVersion: 1 });
    act(() => { vi.advanceTimersByTime(100); });
    expect(body.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)?.textContent).toBe('target');
    expect(result.current.pending).toBeNull();

    // Simulate background host renderContent replacing DOM innerHTML & bumping renderVersion.
    body.innerHTML = rendered.html;
    expect(body.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)).toBeNull();
    rerender({ isLoading: false, renderVersion: 2 });
    act(() => { vi.advanceTimersByTime(60); });
    expect(body.querySelector(`mark.${SEARCH_JUMP_MARK_CLASS}`)?.textContent).toBe('target');

    unregister();
  });
});
