import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';
import { ACTION_NOTICE_EVENT } from '../../../../ui/src/utils/actionNotice';
import { getExportScopeTranslations } from '../../../../ui/src/contexts/exportScopeTranslations';
import { SCOPE_NAVIGATION_REQUEST_EVENT, SCOPE_NAVIGATION_STATE_EVENT } from '../../../../ui/src/components/Modal/scopeHistory';
import { extractScopeTocEntries, ScopeViewToc } from '../../../../ui/src/components/Modal/ScopeViewToc';
import type { DocumentSnapshot } from '../../../../ui/src/export/documentSnapshot';

const mocks = vi.hoisted(() => ({
  loadDocumentSnapshot: vi.fn(),
  postMessage: vi.fn(),
  scheduleEnhancements: vi.fn(() => () => {}),
  toggleViewDropdown: vi.fn(),
  switchView: vi.fn(),
  closeViewDropdown: vi.fn(),
  mermaidSchedule: vi.fn(),
  mermaidDispose: vi.fn(),
  appState: {
    theme: 'light',
    settings: {
      language: 'en',
      keybindings: { back: 'Alt+Left', forward: 'Alt+Right' },
      disabledKeybindings: {},
    },
  },
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mocks.appState }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: mocks.postMessage,
    onMessage: () => () => {},
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: () => {},
  }),
}));

vi.mock('../../../../ui/src/export/documentSnapshot', () => ({
  loadDocumentSnapshot: mocks.loadDocumentSnapshot,
  findScopeFile: (link: { resolved?: string }, candidates: readonly MdFile[]) => {
    if (!link.resolved) return null;
    const target = decodeURIComponent(link.resolved)
      .replace(/^file:\/\//, '')
      .replace(/^\/(?=[a-z]:\/)/i, '')
      .replace(/[?#].*$/, '')
      .replace(/\\/g, '/');
    return candidates.find((candidate) => candidate.fsPath.replace(/\\/g, '/') === target) ?? null;
  },
}));

vi.mock('../../../../ui/src/components/Content/scheduleContentEnhancements', () => ({
  scheduleContentEnhancements: mocks.scheduleEnhancements,
}));

vi.mock('../../../../ui/src/components/Content/enhancements/mermaidAppearance', () => ({
  syncMermaidAppearance: (previousKey: string | null, state: { theme: string }) => ({
    key: state.theme,
    changed: previousKey !== null && previousKey !== state.theme,
  }),
  subscribeToAutoMermaidTheme: () => () => {},
}));

vi.mock('../../../../ui/src/components/Content/enhancements/mermaidRerenderLifecycle', () => ({
  createMermaidRerenderLifecycle: (_body: ParentNode, startEnhancements: () => () => void) => {
    const stop = startEnhancements();
    return {
      schedule: mocks.mermaidSchedule,
      dispose: () => {
        mocks.mermaidDispose();
        stop();
      },
    };
  },
}));

import { ScopeViewModal } from '../../../../ui/src/components/Modal/ScopeViewModal';

function file(index: number): MdFile {
  return {
    fsPath: `/docs/${index}.md`, relativePath: `${index}.md`, parts: [`${index}.md`],
    fileName: `${index}.md`, title: `Doc ${index}`, extension: '.md', documentKind: 'markdown',
  };
}

const files = Array.from({ length: 11 }, (_, index) => file(index + 1));

function snapshot(target: MdFile) {
  const next = Number.parseInt(target.title.replace('Doc ', ''), 10) + 1;
  return {
    file: target,
    markdownSource: `# ${target.title}`,
    html: `<h1>${target.title}</h1>${next <= 11 ? `<a href="./${next}.md">Open ${next}</a>` : ''}`,
  };
}

describe('ScopeViewToc', () => {
  it('updates the visible heading on scroll and jumps with reduced motion', () => {
    const body = document.createElement('div');
    body.innerHTML = '<h1 id="first">First heading</h1><h2 id="second">Second heading</h2>';
    const second = body.querySelector('h2')!;
    second.scrollIntoView = vi.fn();
    second.getBoundingClientRect = () => new DOMRect(0, 200, 10, 20);
    const scroll = document.createElement('div');
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => { frames.delete(frame); });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const flush = () => act(() => {
      for (const [frame, callback] of frames) { frames.delete(frame); callback(0); }
    });
    try {
      const { unmount } = render(<ScopeViewToc
        entries={[{ id: 'first', text: 'First', level: 1 }, { id: 'missing', text: 'Missing', level: 2 }, { id: 'second', text: 'Second', level: 2 }]}
        documentKey="scroll" emptyLabel="No headings" scrollRef={{ current: scroll }} bodyRef={{ current: body }}
      />);
      flush();
      expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-current', 'location');
      second.getBoundingClientRect = () => new DOMRect(0, 50, 10, 20);
      fireEvent.scroll(scroll);
      fireEvent.scroll(scroll);
      expect(frames.size).toBe(1);
      flush();
      expect(screen.getByRole('button', { name: 'Second' })).toHaveAttribute('aria-current', 'location');
      fireEvent.click(screen.getByRole('button', { name: 'Second' }));
      expect(second.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
      unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('uses supplied entries, or derives nonempty headings and stable fallback identifiers from older snapshots', () => {
    const legacy: DocumentSnapshot = { file: file(0), markdownSource: '', html: '' };
    const body = document.createElement('div');
    body.innerHTML = '<h1 id="intro">Intro</h1><h2> </h2><section class="mdn-section" id="parent"><h3> Nested </h3></section><h4>Legacy</h4>';
    const entries = [
      { id: 'intro', text: 'Intro', level: 1 },
      { id: 'parent', text: 'Nested', level: 3 },
      { id: 'scope-toc-heading-3', text: 'Legacy', level: 4 },
    ];
    expect(extractScopeTocEntries(null, body)).toEqual([]);
    expect(extractScopeTocEntries(legacy, null)).toEqual([]);
    expect(extractScopeTocEntries(legacy, body)).toEqual(entries);
    expect(extractScopeTocEntries({ ...legacy, toc: [] }, body)).toEqual([]);
    expect(extractScopeTocEntries({ ...legacy, toc: entries }, null)).toBe(entries);
  });

  it('expands nested sections, scrolls to legacy headings, and resets when the document has no headings', () => {
    const body = document.createElement('div');
    body.innerHTML = '<h1 id="first">First</h1><section class="mdn-section" data-expanded="false"><section class="mdn-section" data-expanded="false"><h2>Second</h2></section></section>';
    const second = body.querySelector('h2')!;
    second.scrollIntoView = vi.fn();
    const bodyRef = { current: body };
    const scrollRef = { current: null };
    const entries = [
      { id: 'first', text: 'First', level: 1 },
      { id: 'scope-toc-heading-8', text: 'Missing', level: 2 },
      { id: 'scope-toc-heading-1', text: 'Second', level: 2 },
    ];
    const props = { bodyRef, scrollRef, emptyLabel: 'No sections' };
    const { rerender } = render(<ScopeViewToc {...props} documentKey="first" entries={entries} />);
    fireEvent.click(screen.getByRole('button', { name: 'Missing' }));
    expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-current', 'location');
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(screen.getByRole('button', { name: 'Second' })).toHaveAttribute('aria-current', 'location');
    expect(second.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(body.querySelectorAll('[data-expanded="true"]')).toHaveLength(2);
    rerender(<ScopeViewToc {...props} documentKey="empty" entries={[]} />);
    expect(screen.getByText('No sections')).toBeInTheDocument();
  });
});

describe('ScopeViewModal', () => {
  beforeEach(() => {
    mocks.loadDocumentSnapshot.mockReset();
    mocks.postMessage.mockReset();
    mocks.scheduleEnhancements.mockReset();
    mocks.scheduleEnhancements.mockImplementation(() => () => {});
    mocks.toggleViewDropdown.mockReset();
    mocks.switchView.mockReset();
    mocks.closeViewDropdown.mockReset();
    mocks.mermaidSchedule.mockReset();
    mocks.mermaidDispose.mockReset();
    mocks.appState.theme = 'light';
    mocks.appState.settings.language = 'en';
    mocks.loadDocumentSnapshot.mockImplementation(async (_bridge: unknown, target: MdFile) => snapshot(target));
    (window as typeof window & { Table?: unknown }).Table = {
      toggleViewDropdown: mocks.toggleViewDropdown,
      switchView: mocks.switchView,
      closeViewDropdown: mocks.closeViewDropdown,
    };
  });

  it('ignores a stale initial read, shows errors, and resets to a closed dialog when the initial file is removed', async () => {
    let complete: (value: ReturnType<typeof snapshot>) => void;
    mocks.loadDocumentSnapshot
      .mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }))
      .mockRejectedValueOnce(new Error('Document no longer exists'));
    const props = { files, onClose: vi.fn() };
    const { rerender } = render(<ScopeViewModal {...props} initialFile={files[0]} />);
    const english = getExportScopeTranslations('en').scopeView;
    expect(screen.getByText(english.loading)).toBeInTheDocument();
    rerender(<ScopeViewModal {...props} initialFile={files[1]} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Document no longer exists');
    await act(async () => complete!(snapshot(files[0])));
    expect(screen.queryByRole('heading', { name: files[0].title })).not.toBeInTheDocument();
    rerender(<ScopeViewModal {...props} initialFile={null} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<ScopeViewModal {...props} initialFile={files[2]} />);
    expect(await screen.findByRole('heading', { name: files[2].title })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses the English close label and generic error for a non-Error initial failure', async () => {
    mocks.appState.settings.language = '';
    mocks.loadDocumentSnapshot.mockRejectedValueOnce('Host unavailable');
    const onClose = vi.fn();
    render(<ScopeViewModal initialFile={files[0]} files={files} onClose={onClose} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(getExportScopeTranslations('en').scopeView.unableOpen);
    fireEvent.click(screen.getByRole('button', { name: 'Close scope view' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('publishes history availability, supports navigation requests, and opens the scoped file only on command', async () => {
    const listener = vi.fn();
    const onClose = vi.fn();
    window.addEventListener(SCOPE_NAVIGATION_STATE_EVENT, listener);
    try {
      const { unmount } = render(<ScopeViewModal files={files} initialFile={files[0]} onClose={onClose} />);
      const english = getExportScopeTranslations('en').scopeView;
      fireEvent.click(await screen.findByRole('link', { name: 'Open 2' }));
      expect(await screen.findByRole('heading', { name: files[1].title })).toBeInTheDocument();
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { active: true, canPrevious: true, canNext: false } }));
      act(() => window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_REQUEST_EVENT, { detail: { direction: 'previous' } })));
      expect(screen.getByRole('heading', { name: files[0].title })).toBeInTheDocument();
      act(() => window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_REQUEST_EVENT, { detail: { direction: 'next' } })));
      expect(mocks.postMessage).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: english.openFile }));
      expect(mocks.postMessage).toHaveBeenCalledExactlyOnceWith({ command: 'navigate', path: files[1].fsPath });
      expect(onClose).toHaveBeenCalledOnce();
      unmount();
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { active: false, canPrevious: false, canNext: false } }));
    } finally {
      window.removeEventListener(SCOPE_NAVIGATION_STATE_EVENT, listener);
    }
  });

  it('allows nested overlays to handle Escape before closing the scope', async () => {
    const onClose = vi.fn();
    render(<ScopeViewModal files={files} initialFile={files[0]} onClose={onClose} />);
    const link = await screen.findByRole('link', { name: 'Open 2' });
    fireEvent.contextMenu(link);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    const media = document.createElement('div');
    media.id = 'mediaModal';
    document.body.append(media);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    media.remove();
    const dropdown = document.createElement('div');
    dropdown.className = 'mdn-filter-dropdown';
    document.body.append(dropdown);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dropdown).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders ten depth segments and enlarges the active segment marker', async () => {
    const { baseElement } = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Doc 1');

    const segments = baseElement.querySelectorAll('.scope-view__depth-segment');
    expect(segments).toHaveLength(10);
    expect(segments[0]).toHaveClass('is-filled', 'is-current');
    expect(baseElement.querySelectorAll('.scope-view__depth-segment.is-current')).toHaveLength(1);
    expect(screen.getByLabelText('Scope level 1 of 10')).toBeTruthy();
  });

  it('opens nested workspace documents without touching main navigation and supports previous/next', async () => {
    const { baseElement } = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Doc 1');

    fireEvent.click(screen.getByText('Open 2'));
    await screen.findByText('Doc 2');
    expect(baseElement.querySelectorAll('.scope-view__depth-segment.is-filled')).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('Previous scope'));
    await screen.findByText('Doc 1');
    fireEvent.click(screen.getByLabelText('Next scope'));
    await screen.findByText('Doc 2');
    expect(mocks.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'navigate' }));
  });

  it('routes configured keyboard and mouse back/forward inputs through the scope stack', async () => {
    render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Doc 1');
    fireEvent.click(screen.getByText('Open 2'));
    await screen.findByText('Doc 2');

    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });
    await waitFor(() => expect(screen.getByText('Doc 1')).toBeTruthy());

    fireEvent.mouseUp(window, { button: 4 });
    await waitFor(() => expect(screen.getByText('Doc 2')).toBeTruthy());

    fireEvent.mouseUp(window, { button: 3 });
    await waitFor(() => expect(screen.getByText('Doc 1')).toBeTruthy());

    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
    await waitFor(() => expect(screen.getByText('Doc 2')).toBeTruthy());
  });

  it('routes BrowserBack/BrowserForward keys through scope stack', async () => {
    render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Doc 1');
    fireEvent.click(screen.getByText('Open 2'));
    await screen.findByText('Doc 2');

    fireEvent.keyDown(window, { key: 'BrowserBack' });
    await waitFor(() => expect(screen.getByText('Doc 1')).toBeTruthy());

    fireEvent.keyDown(window, { key: 'BrowserForward' });
    await waitFor(() => expect(screen.getByText('Doc 2')).toBeTruthy());

    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });
    await waitFor(() => expect(screen.getByText('Doc 1')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
    await waitFor(() => expect(screen.getByText('Doc 2')).toBeTruthy());
  });

  it('offers Open as scope when an internal link is right-clicked inside Scope View', async () => {
    render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    const link = await screen.findByRole('link', { name: 'Open 2' });
    await waitFor(() => expect(mocks.scheduleEnhancements).toHaveBeenCalled());

    fireEvent.contextMenu(link, { clientX: 24, clientY: 30 });
    expect(await screen.findByText('Open as scope')).toBeTruthy();
    fireEvent.click(screen.getByText('Open as scope'));
    await screen.findByText('Doc 2');
  });

  it('blocks the eleventh nested scope and keeps level ten active', async () => {
    const { baseElement } = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Doc 1');

    for (let i = 2; i <= 10; i += 1) {
      fireEvent.click(screen.getByText(`Open ${i}`));
      await screen.findByText(`Doc ${i}`);
    }
    fireEvent.click(screen.getByText('Open 11'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Maximum scope depth reached'));
    expect(baseElement.querySelectorAll('.scope-view__depth-segment.is-filled')).toHaveLength(10);
    expect(screen.getByText('Doc 10')).toBeTruthy();
  });

  it('applies a pending nested scope to the latest history after navigating back', async () => {
    let resolveDocTen: ((value: ReturnType<typeof snapshot>) => void) | null = null;
    mocks.loadDocumentSnapshot.mockImplementation(async (_bridge: unknown, target: MdFile) => {
      if (target.fsPath !== files[9].fsPath) return snapshot(target);
      return new Promise<ReturnType<typeof snapshot>>((resolve) => { resolveDocTen = resolve; });
    });

    const { baseElement } = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Doc 1');
    for (let i = 2; i <= 9; i += 1) {
      fireEvent.click(screen.getByText(`Open ${i}`));
      await screen.findByText(`Doc ${i}`);
    }

    fireEvent.click(screen.getByText('Open 10'));
    await waitFor(() => expect(resolveDocTen).not.toBeNull());
    fireEvent.click(screen.getByLabelText('Previous scope'));
    await screen.findByText('Doc 8');

    await act(async () => {
      resolveDocTen?.(snapshot(files[9]));
      await Promise.resolve();
    });
    await screen.findByText('Doc 10');

    expect(baseElement.querySelectorAll('.scope-view__depth-segment.is-filled')).toHaveLength(9);
    expect(screen.getByLabelText('Scope level 9 of 10')).toBeTruthy();
  });

  it('renders Scope View navigation and link actions in the selected application language', async () => {
    mocks.appState.settings.language = 'vi';
    render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    const link = await screen.findByRole('link', { name: 'Open 2' });
    await waitFor(() => expect(mocks.scheduleEnhancements).toHaveBeenCalled());

    expect(screen.getByRole('dialog', { name: 'Chế độ xem phạm vi' })).toBeTruthy();
    expect(screen.getByLabelText('Phạm vi trước')).toBeTruthy();
    fireEvent.contextMenu(link, { clientX: 24, clientY: 30 });
    expect(await screen.findByText('Mở dưới dạng phạm vi')).toBeTruthy();
  });

  it('collapses and expands document sections inside Scope View', async () => {
    mocks.loadDocumentSnapshot.mockResolvedValue({
      file: files[0],
      markdownSource: '# Doc 1',
      html: '<section class="mdn-section" data-expanded="true"><div class="mdn-section-header" aria-expanded="true">Section heading</div><div class="mdn-section-body">Section body</div></section>',
    });
    const { baseElement } = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Section heading');

    const section = baseElement.querySelector<HTMLElement>('.mdn-section');
    fireEvent.click(screen.getByText('Section heading'));
    expect(section?.dataset.expanded).toBe('false');
    expect(screen.getByText('Section heading')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByText('Section heading'));
    expect(section?.dataset.expanded).toBe('true');
  });

  it('routes table chart dropdown controls inside Scope View', async () => {
    mocks.loadDocumentSnapshot.mockResolvedValue({
      file: files[0],
      markdownSource: '# Doc 1',
      html: '<div class="mdn-table-wrap" id="sales-wrap"><div class="mdn-table-view-dropdown" id="sales-view-dropdown"><button class="mdn-table-view-select">Area Chart</button><div class="mdn-table-view-menu"><button class="mdn-table-view-menu__option" data-value="line">Line Chart</button><button class="mdn-table-view-menu__option">Missing view</button></div></div><div class="mdn-table-view-dropdown"><button class="mdn-table-view-select">Missing table</button></div></div>',
    });
    render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Area Chart');

    fireEvent.click(screen.getByText('Area Chart'));
    expect(mocks.toggleViewDropdown).toHaveBeenCalledTimes(1);
    expect(mocks.toggleViewDropdown).toHaveBeenCalledWith('sales', expect.anything());

    fireEvent.click(screen.getByText('Line Chart'));
    expect(mocks.switchView).toHaveBeenCalledWith('sales', 'line');
    expect(mocks.closeViewDropdown).toHaveBeenCalledWith('sales');
    fireEvent.click(screen.getByText('Missing view'));
    fireEvent.click(screen.getByText('Missing table'));
    expect(mocks.switchView).toHaveBeenCalledOnce();
    expect(mocks.toggleViewDropdown).toHaveBeenCalledOnce();
  });

  it('opens Mermaid diagrams in the shared media viewer from Scope View', async () => {
    const onMediaClick = vi.fn();
    mocks.loadDocumentSnapshot.mockResolvedValue({
      file: files[0],
      markdownSource: '# Doc 1',
      html: '<div class="mdn-mermaid-wrap"><div class="mermaid"><svg aria-label="Scope diagram"></svg></div></div>',
    });
    const { baseElement } = render(
      <ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} onMediaClick={onMediaClick} />,
    );
    await screen.findByLabelText('Scope diagram');

    fireEvent.click(screen.getByLabelText('Scope diagram'));
    expect(onMediaClick).toHaveBeenCalledTimes(1);
    expect(onMediaClick).toHaveBeenCalledWith(baseElement.querySelector('.mdn-mermaid-wrap'));
  });

  it('handles external, fragment, missing workspace, and image links without replacing the scope', async () => {
    const onMediaClick = vi.fn();
    const onClose = vi.fn();
    const html = '<a href="https://example.test/docs">External</a><a href="#scope%2Dheading">Jump</a><a href="missing.md">Missing</a><h2 id="scope-heading">Section</h2><img alt="Scope image" src="image.png">';
    mocks.loadDocumentSnapshot.mockResolvedValue({ ...snapshot(files[0]), html, toc: [] });
    render(<ScopeViewModal initialFile={files[0]} files={files} onClose={onClose} onMediaClick={onMediaClick} />);
    fireEvent.click(await screen.findByRole('link', { name: 'External' }));
    expect(mocks.postMessage).toHaveBeenCalledExactlyOnceWith({ command: 'openExternal', url: 'https://example.test/docs' });
    const section = screen.getByRole('heading', { name: 'Section' });
    section.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole('link', { name: 'Jump' }));
    expect(section.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    const missing = screen.getByRole('link', { name: 'Missing' });
    fireEvent.contextMenu(missing);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(missing);
    expect(screen.getByRole('status')).toHaveTextContent(getExportScopeTranslations('en').scopeView.outsideWorkspace);
    const image = screen.getByRole('img', { name: 'Scope image' });
    fireEvent.click(image);
    expect(onMediaClick).toHaveBeenCalledExactlyOnceWith(image);
    expect(mocks.loadDocumentSnapshot).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    ['Host unavailable', getExportScopeTranslations('en').scopeView.unableOpen],
    [new Error('Document moved'), 'Document moved'],
  ])('keeps the current scope and clears loading when a nested document fails with %s', async (reason, message) => {
    let fail: (reason: unknown) => void;
    mocks.loadDocumentSnapshot
      .mockResolvedValueOnce(snapshot(files[0]))
      .mockReturnValueOnce(new Promise((_, reject) => { fail = reject; }));
    const { baseElement } = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('link', { name: 'Open 2' }));
    expect(baseElement.querySelector('.scope-view__loading-overlay')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: files[0].title })).toBeInTheDocument();
    await act(async () => fail!(reason));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(baseElement.querySelector('.scope-view__loading-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: files[0].title })).toBeInTheDocument();
  });

  it('rerenders Mermaid when Scope View appearance changes', async () => {
    const view = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Doc 1');
    expect(mocks.mermaidSchedule).not.toHaveBeenCalled();

    mocks.appState.theme = 'dark';
    view.rerender(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await waitFor(() => expect(mocks.mermaidSchedule).toHaveBeenCalledTimes(1));
  });

  it('does not push a self-link onto the scope stack and shows the app toast', async () => {
    mocks.loadDocumentSnapshot.mockResolvedValue({
      file: files[0],
      markdownSource: '# Doc 1',
      html: '<h1>Doc 1</h1><a href="./1.md">Open self</a>',
    });
    const notices: string[] = [];
    const onNotice = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) notices.push(detail.message);
    };
    window.addEventListener(ACTION_NOTICE_EVENT, onNotice);
    try {
      const { baseElement } = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
      const link = await screen.findByRole('link', { name: 'Open self' });
      await waitFor(() => expect(mocks.scheduleEnhancements).toHaveBeenCalled());
      fireEvent.click(link);

      await waitFor(() => expect(notices).toContain('You are currently viewing this document.'));
      expect(mocks.loadDocumentSnapshot).toHaveBeenCalledTimes(1);
      expect(baseElement.querySelectorAll('.scope-view__depth-segment.is-filled')).toHaveLength(1);
    } finally {
      window.removeEventListener(ACTION_NOTICE_EVENT, onNotice);
    }
  });

  it('falls back to English with an unknown locale and recognizes a Windows self-link despite a case change', async () => {
    mocks.appState.settings.language = 'legacy';
    const active = { ...files[0], fsPath: 'C:/Docs/1.md' };
    const same = { ...active, fsPath: 'c:/docs/1.md' };
    mocks.loadDocumentSnapshot.mockResolvedValue({ ...snapshot(active), html: '<a href="file:///c:/docs/1.md">Same file</a>' });
    const notice = vi.fn();
    window.addEventListener(ACTION_NOTICE_EVENT, notice);
    try {
      render(<ScopeViewModal initialFile={active} files={[same]} onClose={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Close scope view' })).toBeVisible();
      fireEvent.click(await screen.findByRole('link', { name: 'Same file' }));
      expect(mocks.loadDocumentSnapshot).toHaveBeenCalledOnce();
      expect(notice).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        detail: expect.objectContaining({ message: 'You are currently viewing this document.' }),
      }));
    } finally {
      window.removeEventListener(ACTION_NOTICE_EVENT, notice);
    }
  });

  it('portals Scope View directly into document.body and toggles the scope file TOC from the header', async () => {
    mocks.loadDocumentSnapshot.mockImplementation(async (_bridge: unknown, target: MdFile) => ({
      file: target,
      markdownSource: `# ${target.title}\n## Sub Section`,
      html: `<section class="mdn-section" id="sec-1" data-expanded="true"><div class="mdn-section-header" aria-expanded="true"><h1>${target.title}</h1></div></section><h2 id="sub-1">Sub Section</h2><a href="./2.md">Open 2</a>`,
      toc: [
        { level: 1, text: target.title, id: 'sec-1' },
        { level: 2, text: 'Sub Section', id: 'sub-1' },
      ],
    }));

    const { baseElement } = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Doc 1');

    const dialog = screen.getByRole('dialog', { name: 'Scope view' });
    expect(dialog.parentElement).toBe(document.body);

    const toggleButton = screen.getByRole('button', { name: 'Toggle table of contents' });
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    expect(baseElement.querySelector('.scope-view__toc')).toBeNull();

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
    const tocPanel = baseElement.querySelector('.scope-view__toc');
    expect(tocPanel).not.toBeNull();
    expect(tocPanel?.textContent).toContain('Sub Section');

    const targetHeading = baseElement.querySelector<HTMLElement>('#sub-1')!;
    const scrollIntoView = vi.fn();
    targetHeading.scrollIntoView = scrollIntoView;
    fireEvent.click(tocPanel!.querySelectorAll('.toc-item')[1]!);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Open 2'));
    await screen.findByRole('heading', { name: 'Doc 2' });
    expect(baseElement.querySelector('.scope-view__toc')?.textContent).toContain('Doc 2');

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    expect(baseElement.querySelector('.scope-view__toc')).toBeNull();
  });
});
