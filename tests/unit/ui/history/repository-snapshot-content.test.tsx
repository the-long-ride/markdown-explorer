import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type AppState } from '../../../../ui/src/contexts/appStateModel';
import { formatSnapshotCommitDate, RepositorySnapshotContent } from '../../../../ui/src/components/History/RepositorySnapshotContent';
import { RepositorySnapshotPortal } from '../../../../ui/src/components/History/RepositorySnapshotPortal';
import { TableOfContents } from '../../../../ui/src/components/TOC/TableOfContents';
import { getDocumentRoot, registerDocumentRoot, resetDocumentRoots } from '../../../../ui/src/document/activeDocumentRoot';
import { registerTableHandlers } from '../../../../ui/src/dom/tableHandlers';
import {
  resolveSnapshotDocumentFilePath,
  resolveSnapshotLinkTarget,
  stripSnapshotInlineNavHandlers,
} from '../../../../ui/src/history/snapshotLinkResolution';
import { renderMarkdownClientSide } from '../../../../ui/src/contexts/contentTabState';
import type { GitRevisionFile, GitRevisionFileSnapshot } from '../../../../ui/src/history/contracts';
import type { RepositorySnapshotContextValue } from '../../../../ui/src/contexts/RepositorySnapshotContext';
import { ACTION_NOTICE_EVENT } from '../../../../ui/src/utils/actionNotice';

const mocks = vi.hoisted(() => ({
  appState: null as unknown as AppState,
  bridge: {
    postMessage: vi.fn(),
    copyToClipboard: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn(() => () => undefined),
  },
  snapshotContext: null as unknown as RepositorySnapshotContextValue,
  mermaidRun: vi.fn(),
  mermaidInitialize: vi.fn(),
  chartCtor: vi.fn(),
  setSidebarActiveTab: vi.fn(),
  setSidebarCollapsed: vi.fn(),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mocks.appState,
    setSidebarActiveTab: mocks.setSidebarActiveTab,
    setSidebarCollapsed: mocks.setSidebarCollapsed,
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => mocks.bridge,
}));

vi.mock('../../../../ui/src/contexts/RepositorySnapshotContext', () => ({
  useRepositorySnapshot: () => mocks.snapshotContext,
}));

vi.mock('../../../../ui/src/lib/renderLibs', () => ({
  getMermaid: async () => ({
    initialize: mocks.mermaidInitialize,
    run: mocks.mermaidRun,
  }),
  getChart: async () => {
    (window as any).Chart = mocks.chartCtor;
    return mocks.chartCtor;
  },
  getHighlightJs: async () => ({
    highlightElement: () => undefined,
  }),
  getKatex: async () => ({
    render: (math: string, el: HTMLElement) => {
      el.textContent = math;
    },
  }),
}));

const OID = 'a'.repeat(40);
const HEAD_OID = 'h'.repeat(40);

const REPO_FILES: GitRevisionFile[] = [
  { path: 'README.md' },
  { path: 'docs/macos-install.md' },
  { path: 'manual-tests/test-navigation.md' },
  { path: 'manual-tests/test-interactive.mdx' },
  { path: 'manual-tests/test-basic.md' },
  { path: 'manual-tests/test-diagrams.md' },
  { path: 'manual-tests/test-large-table.md' },
];

function makeAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...initialState,
    workspacePath: 'D:\\repo',
    workspaceName: 'repo',
    theme: 'dark',
    themeStyle: 'raw-grid',
    tocCollapsed: false,
    settings: {
      ...initialState.settings,
      language: 'en',
      bookmarksEnabled: true,
    },
    ...overrides,
  };
}

function makeSnapshotContext(
  activeFile: GitRevisionFileSnapshot | null,
  overrides: Partial<RepositorySnapshotContextValue> = {},
): RepositorySnapshotContextValue {
  const rendered = activeFile && /\.mdx?$/i.test(activeFile.path)
    ? renderMarkdownClientSide(activeFile.source, activeFile.path, /\.mdx$/i.test(activeFile.path), mocks.appState.settings)
    : null;
  return {
    state: {
      selectedOid: OID,
      headOid: HEAD_OID,
      files: REPO_FILES,
      activePath: activeFile?.path ?? null,
      activeFile,
      status: 'ready',
      error: null,
    },
    commits: [],
    repositoryView: { mode: 'revision', oid: OID, headOid: HEAD_OID },
    revisionWorkspace: null,
    activeRendered: rendered,
    activeToc: rendered?.toc ?? [],
    hasMoreHistory: false,
    isLoadingMoreHistory: false,
    allRefs: false,
    setAllRefs: vi.fn(),
    loadHistory: vi.fn().mockResolvedValue(undefined),
    loadMoreHistory: vi.fn().mockResolvedValue(undefined),
    selectCommit: vi.fn().mockResolvedValue(undefined),
    activateWorkspaceRevision: vi.fn().mockResolvedValue(undefined),
    openSnapshotFile: vi.fn().mockResolvedValue(undefined),
    searchRevision: vi.fn().mockResolvedValue([]),
    returnToHead: vi.fn(),
    ...overrides,
  };
}

describe('snapshotLinkResolution', () => {
  it('resolves same-folder, root-relative, parent-directory, wiki, fragment, external, and missing links', () => {
    expect(resolveSnapshotLinkTarget('./test-interactive.mdx', 'manual-tests/test-navigation.md', REPO_FILES)).toEqual({
      kind: 'snapshot-file',
      path: 'manual-tests/test-interactive.mdx',
      fragment: null,
    });
    expect(resolveSnapshotLinkTarget('/manual-tests/test-basic.md#intro', 'manual-tests/test-navigation.md', REPO_FILES)).toEqual({
      kind: 'snapshot-file',
      path: 'manual-tests/test-basic.md',
      fragment: 'intro',
    });
    expect(resolveSnapshotLinkTarget('../README.md', 'manual-tests/test-navigation.md', REPO_FILES)).toEqual({
      kind: 'snapshot-file',
      path: 'README.md',
      fragment: null,
    });
    expect(resolveSnapshotLinkTarget('../docs/macos-install.md', 'manual-tests/test-navigation.md', REPO_FILES)).toEqual({
      kind: 'snapshot-file',
      path: 'docs/macos-install.md',
      fragment: null,
    });
    expect(resolveSnapshotLinkTarget('test-basic', 'manual-tests/test-navigation.md', REPO_FILES, { isWikiLink: true })).toEqual({
      kind: 'snapshot-file',
      path: 'manual-tests/test-basic.md',
      fragment: null,
    });
    expect(resolveSnapshotLinkTarget('#section-one', 'manual-tests/test-navigation.md', REPO_FILES)).toEqual({
      kind: 'fragment',
      fragment: 'section-one',
    });
    expect(resolveSnapshotLinkTarget('https://github.com/example', 'manual-tests/test-navigation.md', REPO_FILES)).toEqual({
      kind: 'external',
      url: 'https://github.com/example',
    });
    expect(resolveSnapshotLinkTarget('./does-not-exist.md', 'manual-tests/test-navigation.md', REPO_FILES)).toEqual({
      kind: 'not-found',
      targetPath: 'manual-tests/does-not-exist.md',
    });
    expect(resolveSnapshotLinkTarget('javascript:alert(1)', 'manual-tests/test-navigation.md', REPO_FILES)).toBeNull();
  });

  it('strips inline Nav.go onclick handlers and joins workspace paths cleanly', () => {
    const html = '<a href="#" data-mdn-target="./test-interactive.mdx" onclick="Nav.go(\'./test-interactive.mdx\');return false;">Interactive MDX</a>';
    expect(stripSnapshotInlineNavHandlers(html)).not.toContain('Nav.go');
    expect(resolveSnapshotDocumentFilePath('D:\\repo\\', 'manual-tests/test-navigation.md')).toBe('D:\\repo/manual-tests/test-navigation.md');
    expect(resolveSnapshotDocumentFilePath(undefined, '/manual-tests/test-navigation.md')).toBe('manual-tests/test-navigation.md');
  });
});

describe('RepositorySnapshotContent', () => {
  beforeEach(() => {
    resetDocumentRoots();
    mocks.appState = makeAppState();
    mocks.bridge.postMessage.mockClear();
    mocks.bridge.copyToClipboard.mockClear();
    mocks.mermaidInitialize.mockClear();
    mocks.mermaidRun.mockReset().mockImplementation(async ({ nodes }: { nodes: HTMLElement[] }) => {
      nodes.forEach((node, index) => {
        const code = node.dataset.originalCode || node.textContent || '';
        node.innerHTML = `<svg id="mermaid-test-${index}" viewBox="0 0 120 80"><text>${code.slice(0, 20)}</text></svg>`;
      });
    });
    mocks.chartCtor.mockReset().mockImplementation(function MockChart(this: any) {
      this.destroy = vi.fn();
    });
    const win = window as any;
    win.UI = {};
    win.Table = {};
    win.Nav = { go: vi.fn() };
    win.Chart = undefined;
    registerTableHandlers(win);
  });

  afterEach(() => {
    resetDocumentRoots();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders tagged and untagged Mermaid diagrams, re-renders on theme change, and opens MediaModal on click', async () => {
    const source = [
      '# Diagrams',
      '',
      '```mermaid',
      'flowchart LR',
      '  A[Start] --> B[End]',
      '```',
      '',
      '```',
      'sequenceDiagram',
      '  Alice->>Bob: Hi',
      '```',
    ].join('\n');
    mocks.snapshotContext = makeSnapshotContext({ oid: OID, path: 'manual-tests/test-diagrams.md', source });

    const openedMedia: any[] = [];
    const onMedia = (event: Event) => openedMedia.push((event as CustomEvent).detail);
    window.addEventListener('markdown-explorer-open-media-modal', onMedia);

    const { container, rerender } = render(<RepositorySnapshotContent />);

    await waitFor(() => {
      const svgs = container.querySelectorAll('.repository-snapshot-content__body .mermaid svg');
      expect(svgs.length).toBe(2);
    });
    expect(mocks.mermaidRun).toHaveBeenCalledTimes(2);

    // Click a rendered Mermaid SVG -> opens MediaModal with snapshot gallery
    const firstSvg = container.querySelector<SVGElement>('.repository-snapshot-content__body .mermaid svg')!;
    fireEvent.click(firstSvg);
    expect(openedMedia).toHaveLength(1);
    expect(openedMedia[0].items).toHaveLength(2);
    expect(openedMedia[0].items[0].type).toBe('svg');
    expect(openedMedia[0].items[0].source).toContain('flowchart LR');

    // Theme change -> re-renders Mermaid diagrams cleanly
    mocks.appState = makeAppState({ theme: 'light' });
    rerender(<RepositorySnapshotContent />);

    await waitFor(() => {
      expect(mocks.mermaidRun.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    window.removeEventListener('markdown-explorer-open-media-modal', onMedia);
  });

  it('connects both compact and panel TableOfContents to snapshot headings and scroll container', async () => {
    const source = [
      '# Snapshot Title',
      '',
      'Intro paragraph.',
      '',
      '## First Section',
      '',
      'Content one.',
      '',
      '## Second Section',
      '',
      'Content two.',
    ].join('\n');
    mocks.snapshotContext = makeSnapshotContext({ oid: OID, path: 'manual-tests/toc.md', source });

    // Mount a decoy live document root with the same heading IDs to ensure TOC scopes to snapshot.
    const liveBody = document.createElement('div');
    liveBody.id = 'mdBody';
    liveBody.innerHTML = '<h2 id="second-section">Live Decoy</h2>';
    const liveScrollIntoView = vi.fn();
    liveBody.querySelector<HTMLElement>('#second-section')!.scrollIntoView = liveScrollIntoView;
    document.body.appendChild(liveBody);
    registerDocumentRoot({ id: 'main', body: liveBody, scroll: null, filePath: 'D:\\repo/live.md', markdownSource: '' });

    const { container } = render(
      <>
        <TableOfContents
          variant="panel"
          entries={mocks.snapshotContext.activeToc}
          rootId="snapshot"
          documentKey={`${OID}:manual-tests/toc.md`}
        />
        <RepositorySnapshotContent />
      </>,
    );

    await waitFor(() => {
      expect(getDocumentRoot('snapshot')).not.toBeNull();
      expect(container.querySelector('.toc-compact')).not.toBeNull();
    });

    const snapshotHeading = container.querySelector<HTMLElement>('.repository-snapshot-content__body [id="second-section"]')!;
    expect(snapshotHeading).not.toBeNull();
    const snapshotScrollIntoView = vi.fn();
    snapshotHeading.scrollIntoView = snapshotScrollIntoView;

    // Collapse the parent section first to verify TOC expands it on click.
    const parentSection = snapshotHeading.closest<HTMLElement>('.mdn-section')!;
    parentSection.dataset.expanded = 'false';

    // Click panel TOC item
    const panelButtons = container.querySelectorAll<HTMLButtonElement>('#tocItems .toc-item');
    expect(panelButtons.length).toBe(3);
    const secondPanelItem = Array.from(panelButtons).find((btn) => btn.textContent?.includes('Second Section'))!;
    fireEvent.click(secondPanelItem);
    expect(parentSection.dataset.expanded).toBe('true');
    expect(snapshotScrollIntoView).toHaveBeenCalledTimes(1);
    expect(liveScrollIntoView).not.toHaveBeenCalled();

    // Scroll snapshot container past Second Section -> active heading updates in panel TOC
    const snapshotScroll = container.querySelector<HTMLElement>('.repository-snapshot-content__scroll')!;
    const titleHeading = container.querySelector<HTMLElement>('.repository-snapshot-content__body [id="snapshot-title"]')!;
    const firstHeading = container.querySelector<HTMLElement>('.repository-snapshot-content__body [id="first-section"]')!;
    snapshotScroll.getBoundingClientRect = () => ({ top: 100, bottom: 600, height: 500 } as DOMRect);
    titleHeading.getBoundingClientRect = () => ({ top: -400, bottom: -360, height: 40 } as DOMRect);
    firstHeading.getBoundingClientRect = () => ({ top: -120, bottom: -80, height: 40 } as DOMRect);
    snapshotHeading.getBoundingClientRect = () => ({ top: 130, bottom: 170, height: 40 } as DOMRect);
    Object.defineProperty(snapshotScroll, 'scrollTop', { value: 250, configurable: true });
    Object.defineProperty(snapshotScroll, 'clientHeight', { value: 500, configurable: true });
    Object.defineProperty(snapshotScroll, 'scrollHeight', { value: 1500, configurable: true });
    fireEvent.scroll(snapshotScroll);
    await waitFor(() => {
      expect(secondPanelItem).toHaveAttribute('aria-current', 'location');
      expect(secondPanelItem.classList.contains('is-active')).toBe(true);
    });

    // Open compact TOC and click an item
    const compactToggle = container.querySelector<HTMLButtonElement>('.toc-compact__toggle')!;
    fireEvent.click(compactToggle);
    expect(compactToggle).toHaveAttribute('aria-expanded', 'true');
    const compactSecond = Array.from(container.querySelectorAll<HTMLButtonElement>('.toc-compact__menu .toc-item'))
      .find((btn) => btn.textContent?.includes('Second Section'))!;
    fireEvent.click(compactSecond);
    expect(snapshotScrollIntoView).toHaveBeenCalledTimes(2);
    expect(compactToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('portals RepositorySnapshotContent into .content-shell__main only in revision mode', () => {
    const shell = document.createElement('div');
    shell.className = 'content-shell__main';
    document.body.appendChild(shell);

    mocks.snapshotContext = makeSnapshotContext({ oid: OID, path: 'README.md', source: '# Hello' });
    const { rerender } = render(<RepositorySnapshotPortal />);
    expect(shell.querySelector('[data-testid="repository-snapshot-content"]')).not.toBeNull();

    mocks.snapshotContext = makeSnapshotContext(null, { repositoryView: { mode: 'live' } });
    rerender(<RepositorySnapshotPortal />);
    expect(shell.querySelector('[data-testid="repository-snapshot-content"]')).toBeNull();
  });

  it('enhances large tables with sticky headers, Show More/Show Less, and View as chart', async () => {
    const rows = Array.from({ length: 22 }, (_, i) =>
      `| ${i + 1} | 2024-01-${String(i + 1).padStart(2, '0')} | ${(100 + i * 25).toFixed(2)} | Alpha |`,
    );
    const source = [
      '# Large Telemetry Table',
      '',
      '| Index | Date | Metric Value | Category |',
      '| --- | --- | ---: | --- |',
      ...rows,
    ].join('\n');
    mocks.snapshotContext = makeSnapshotContext({ oid: OID, path: 'manual-tests/test-large-table.md', source });

    const { container } = render(<RepositorySnapshotContent />);

    await waitFor(() => {
      const table = container.querySelector<HTMLTableElement>('.mdn-table');
      expect(table?.dataset.mdnEnhanced).toBe('true');
    });

    const scroll = container.querySelector<HTMLElement>('.repository-snapshot-content__scroll')!;
    const table = container.querySelector<HTMLTableElement>('.mdn-table')!;
    const thead = table.querySelector<HTMLElement>('thead')!;
    const countEl = document.getElementById(`${table.id}-count`)!;
    const toggleBtn = document.getElementById(`${table.id}-toggle-btn`) as HTMLButtonElement;
    const viewSelect = container.querySelector<HTMLButtonElement>('.mdn-table-view-select')!;

    expect(countEl.textContent).toContain('22');
    expect(toggleBtn.style.display).not.toBe('none');
    expect(viewSelect).not.toBeNull();

    // Scroll down past table top -> thead translates to stay sticky; scroll back to top -> transform clears (never stuck mid-table!)
    Object.defineProperty(scroll, 'clientTop', { value: 0, configurable: true });
    scroll.getBoundingClientRect = () => ({ top: 80, bottom: 580, height: 500 } as DOMRect);
    thead.getBoundingClientRect = () => ({ top: 0, height: 32 } as DOMRect);

    let tableTop = -120;
    table.getBoundingClientRect = () => ({ top: tableTop, height: 800 } as DOMRect);
    fireEvent.scroll(scroll);
    expect(scroll.dataset.mdnJsStickyHeaders).toBe('true');
    expect(thead.style.transform).toBe('translateY(200px)');

    // Expand Show More while scrolled partway down, then scroll back up to top of table
    const wrap = document.getElementById(`${table.id}-wrap`)!;
    wrap.scrollIntoView = vi.fn();
    (window as any).Table.toggleCollapse(table.id);
    expect(toggleBtn.classList.contains('is-expanded')).toBe(true);

    tableTop = 120;
    fireEvent.scroll(scroll);
    expect(thead.style.transform).toBe('');

    // Open View as chart dropdown and switch to Bar Chart
    fireEvent.click(viewSelect);
    const barOption = container.querySelector<HTMLButtonElement>('.mdn-table-view-menu__option[data-value="bar"]')!;
    expect(barOption).not.toBeNull();
    fireEvent.click(barOption);

    await waitFor(() => {
      const chartContainer = document.getElementById(`${table.id}-chart-container`)!;
      expect(chartContainer.style.display).toBe('block');
      expect(mocks.chartCtor).toHaveBeenCalledTimes(1);
    });
  });

  it('navigates relative, root, parent, fragment, wiki, and external links and opens link context menu on right-click', async () => {
    const source = [
      '# Navigation Test',
      '',
      '- [Interactive MDX](./test-interactive.mdx)',
      '- [Workspace Root](/manual-tests/test-basic.md)',
      '- [Parent README](../README.md)',
      '- [Missing](./missing-file.md)',
      '- [Jump](#target-heading)',
      '- [[test-basic]]',
      '- [GitHub](https://github.com/the-long-ride/markdown-explorer)',
      '',
      '## Target Heading',
      '',
      'Destination body.',
    ].join('\n');
    const openSnapshotFile = vi.fn().mockResolvedValue(undefined);
    mocks.snapshotContext = makeSnapshotContext(
      { oid: OID, path: 'manual-tests/test-navigation.md', source },
      { openSnapshotFile },
    );

    const notices: any[] = [];
    const onNotice = (event: Event) => notices.push((event as CustomEvent).detail);
    window.addEventListener(ACTION_NOTICE_EVENT, onNotice);

    const { container } = render(<RepositorySnapshotContent />);

    // Inline onclick="Nav.go(...)" must be stripped so live navigation is never called
    const mdxLink = screen.getByText('Interactive MDX').closest('a')!;
    expect(mdxLink.hasAttribute('onclick')).toBe(false);

    fireEvent.click(mdxLink);
    expect(openSnapshotFile).toHaveBeenLastCalledWith('manual-tests/test-interactive.mdx');
    expect((window as any).Nav.go).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Workspace Root').closest('a')!);
    expect(openSnapshotFile).toHaveBeenLastCalledWith('manual-tests/test-basic.md');

    fireEvent.click(screen.getByText('Parent README').closest('a')!);
    expect(openSnapshotFile).toHaveBeenLastCalledWith('README.md');

    fireEvent.click(screen.getByText('test-basic').closest('a')!);
    expect(openSnapshotFile).toHaveBeenLastCalledWith('manual-tests/test-basic.md');

    // Fragment link scrolls inside snapshot body
    const targetHeading = container.querySelector<HTMLElement>('[id="target-heading"]')!;
    const scrollIntoView = vi.fn();
    targetHeading.scrollIntoView = scrollIntoView;
    fireEvent.click(screen.getByText('Jump').closest('a')!);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // External link opens externally
    fireEvent.click(screen.getByText('GitHub').closest('a')!);
    expect(mocks.bridge.postMessage).toHaveBeenCalledWith({
      command: 'openExternal',
      url: 'https://github.com/the-long-ride/markdown-explorer',
    });

    // Missing file shows error notice without navigating
    fireEvent.click(screen.getByText('Missing').closest('a')!);
    expect(notices.some((n) => n?.tone === 'error')).toBe(true);

    // Right-click on link opens LinkContextMenu and copies resolved link
    fireEvent.contextMenu(mdxLink, { clientX: 100, clientY: 120 });
    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();
    const copyItem = screen.getByRole('menuitem', { name: /copy link/i });
    await act(async () => {
      fireEvent.click(copyItem);
    });
    expect(mocks.bridge.copyToClipboard).toHaveBeenCalledTimes(1);
    expect(mocks.bridge.copyToClipboard.mock.calls[0][0]).toContain('manual-tests/test-interactive.mdx');

    window.removeEventListener(ACTION_NOTICE_EVENT, onNotice);
  });

  it('keeps expanded code block Show Less button sticky within the snapshot viewport', async () => {
    const longCode = Array.from({ length: 30 }, (_, i) => `const line${i + 1} = ${i + 1};`).join('\n');
    const source = `# Long Code\n\n\`\`\`ts\n${longCode}\n\`\`\`\n`;
    mocks.snapshotContext = makeSnapshotContext({ oid: OID, path: 'manual-tests/test-code.md', source });

    const { container } = render(<RepositorySnapshotContent />);

    const scroll = container.querySelector<HTMLElement>('.repository-snapshot-content__scroll')!;
    const codeBlock = container.querySelector<HTMLElement>('.mdn-codeblock')!;
    const toggleBtn = container.querySelector<HTMLButtonElement>('.mdn-codeblock-toggle-btn')!;

    expect(codeBlock.dataset.collapsed).toBe('true');
    expect(scroll.dataset.mdnJsStickyHeaders).toBe('true');
    expect(scroll.style.getPropertyValue('--mdn-sticky-bottom-offset')).not.toBe('');

    (window as any).UI.toggleCodeCollapse(toggleBtn);
    expect(codeBlock.dataset.collapsed).toBe('false');
    expect(toggleBtn.textContent).toBe('Show Less');

    // Verify CSS contracts that keep sticky bottom controls inside the snapshot viewport
    const historyCss = readFileSync(resolve(process.cwd(), 'ui/src/styles/global/global-history-diff.css'), 'utf8');
    const codeCss = readFileSync(resolve(process.cwd(), 'ui/src/styles/global/global-code-blocks.css'), 'utf8');
    const cyberpunkCss = readFileSync(resolve(process.cwd(), 'ui/src/styles/global/global-theme-cyberpunk.css'), 'utf8');

    expect(historyCss).toMatch(/\.repository-snapshot-content__header\s*\{[^}]*flex:\s*0 0 auto;/);
    expect(historyCss).toMatch(/:root\[data-theme\]\[data-theme-style\]\s+\.repository-snapshot-content\s*>\s*\.content__scroll\.repository-snapshot-content__scroll\s*\{[^}]*flex:\s*1 1 0;[^}]*min-height:\s*0;/);
    expect(codeCss).toMatch(/\.mdn-codeblock\[data-collapsed="false"\]\s+\.mdn-codeblock-toggle-btn\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*var\(--mdn-sticky-bottom-offset,\s*0px\);/s);
    expect(cyberpunkCss).toContain('.content:not(.repository-snapshot-content)');
  });

  it('renders literal source for a non-Markdown snapshot file', () => {
    const source = '<script type="application/json">{"example":true}</script>';
    mocks.snapshotContext = makeSnapshotContext({ oid: OID, path: 'config/example.html', source });
    const { container } = render(<RepositorySnapshotContent />);
    expect(screen.getByText('config/example.html')).toBeInTheDocument();
    expect(container.querySelector('pre code')).toHaveTextContent(source);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('article')).toBeNull();
  });

  it('renders Markdown locally when pre-rendered content is unavailable', () => {
    mocks.appState.tocCollapsed = true;
    const source = '---\nstatus: ready\n---\n\n<!-- private note -->\n\n# Offline snapshot\n\nDetails.';
    mocks.snapshotContext = makeSnapshotContext({ oid: OID, path: 'docs/offline.mdx', source }, { activeRendered: undefined });
    const { container } = render(<RepositorySnapshotContent />);
    expect(screen.getByRole('heading', { name: 'Offline snapshot' })).toBeInTheDocument();
    expect(screen.getByText('Details.')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(container.querySelector('article')).toHaveAttribute('data-mdn-source-document-path', 'docs/offline.mdx');
  });

  it.each([
    [' Jane Doe ', '', 'Authored by Jane Doe'],
    ['', '2026-01-15', 'Authored on 15 Jan 2026'],
    ['', '', null],
  ] as const)('handles partial commit metadata for author %j and date %j', (author, authoredAt, metadata) => {
    mocks.appState.sidebarCollapsed = false;
    mocks.setSidebarCollapsed.mockClear();
    mocks.setSidebarActiveTab.mockClear();
    mocks.snapshotContext = makeSnapshotContext(null, {
      commits: [{ oid: OID, shortOid: '', parentOids: [], author, authoredAt, subject: ' ', refs: [], isHead: false }],
    });
    const { container } = render(<RepositorySnapshotContent />);
    const panel = screen.getByTestId('repository-snapshot-commit-panel');
    expect(panel).toHaveTextContent(OID.slice(0, 7));
    expect(screen.getByRole('heading')).not.toBeEmptyDOMElement();
    const meta = container.querySelector('.repository-snapshot-content__commit-meta');
    if (metadata) expect(meta).toHaveTextContent(metadata);
    else expect(meta).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Explore Files' }));
    expect(mocks.setSidebarActiveTab).toHaveBeenCalledWith('files');
    expect(mocks.setSidebarCollapsed).not.toHaveBeenCalled();
  });

  it('renders a centered commit info panel when no snapshot file is opened yet, with Explore Files and Back to current HEAD actions', () => {
    mocks.appState.sidebarCollapsed = true;
    mocks.setSidebarActiveTab.mockClear();
    mocks.setSidebarCollapsed.mockClear();
    const returnToHead = vi.fn();

    mocks.snapshotContext = makeSnapshotContext(null, {
      commits: [{
        oid: OID,
        shortOid: '5c29d99',
        parentOids: [],
        author: 'Long Trinh',
        authoredAt: '2026-01-15T10:30:00Z',
        subject: 'fix(ci): resolve audit vulnerabilities',
        refs: [],
        isHead: false,
      }],
      returnToHead,
    });

    render(<RepositorySnapshotContent />);

    expect(screen.queryByText('Open read-only snapshot')).not.toBeInTheDocument();
    const panel = screen.getByTestId('repository-snapshot-commit-panel');
    expect(panel).toHaveTextContent('Viewing commit');
    expect(panel).toHaveTextContent('5c29d99');
    expect(panel).toHaveTextContent('fix(ci): resolve audit vulnerabilities');
    expect(panel).toHaveTextContent('Authored by Long Trinh on 15 Jan 2026');
    expect(formatSnapshotCommitDate('2026-01-15')).toBe('15 Jan 2026');

    fireEvent.click(screen.getByRole('button', { name: 'Explore Files' }));
    expect(mocks.setSidebarCollapsed).toHaveBeenCalledWith(false);
    expect(mocks.setSidebarActiveTab).toHaveBeenCalledWith('files');

    const backButtons = screen.getAllByRole('button', { name: 'Back to current HEAD' });
    fireEvent.click(backButtons[backButtons.length - 1]);
    expect(returnToHead).toHaveBeenCalledTimes(1);
  });
});
