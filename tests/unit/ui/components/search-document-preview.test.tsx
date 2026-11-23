import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchDocumentPreview } from '../../../../ui/src/components/Search/SearchDocumentPreview';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import type { HostMessage } from '../../../../ui/src/types';

const { schedule, jump } = vi.hoisted(() => ({ schedule: vi.fn(), jump: vi.fn() }));
vi.mock('../../../../ui/src/components/Content/scheduleContentEnhancements', () => ({ scheduleContentEnhancements: schedule }));
vi.mock('../../../../ui/src/utils/searchJump', () => ({ scrollToRenderedSearchMatchInRoot: jump }));
vi.mock('../../../../ui/src/contexts/contentTabState', () => ({
  renderMarkdownClientSide: (html: string) => ({ html }),
}));

const result = {
  fsPath: '/docs/guide.md', fileName: 'guide.md', relativePath: 'guide.md', title: 'Guide',
};

function fixture() {
  const listeners: Array<(message: HostMessage) => void> = [];
  const unsubscribe = vi.fn();
  const bridge = {
    onMessage: (handler) => { listeners.push(handler); return unsubscribe; },
    postMessage: vi.fn<PlatformBridge['postMessage']>(),
    getState: () => undefined,
    setState: vi.fn(),
    copyToClipboard: vi.fn(),
  } satisfies PlatformBridge;
  const stop = vi.fn();
  schedule.mockReturnValue(stop);
  const props = {
    bridge, item: result, theme: initialState.theme, settings: initialState.settings,
    query: 'guide', matchCase: true, loadingLabel: 'Loading document', errorLabel: 'Document unavailable',
  };
  function request(index = listeners.length - 1) {
    const message = bridge.postMessage.mock.calls[index][0];
    if (message.command !== 'loadSearchPreview') throw new Error('Expected a preview request');
    return message;
  }
  function reply(markdownSource: string | undefined, { index, id, ok = true }: { index?: number; id?: string; ok?: boolean } = {}) {
    const requestMessage = request(index);
    act(() => listeners[index ?? listeners.length - 1]({
      command: 'searchPreviewResult', requestId: id ?? requestMessage.requestId,
      filePath: requestMessage.filePath, ok, markdownSource,
    }));
  }
  return { props, bridge, request, reply, unsubscribe, stop };
}

describe('search document preview', () => {
  it('correlates host responses, reloads only on result identity change, and stops enhancements', () => {
    vi.useFakeTimers();
    const { props, bridge, request, reply, unsubscribe, stop } = fixture();
    const { rerender, unmount } = render(<SearchDocumentPreview {...props} item={null} />);
    expect(bridge.postMessage).not.toHaveBeenCalled();
    rerender(<SearchDocumentPreview {...props} />);
    expect(screen.getByText(props.loadingLabel)).toBeInTheDocument();
    reply('<p>Unrelated</p>', { id: 'other-request' });
    expect(screen.getByText(props.loadingLabel)).toBeInTheDocument();
    reply(undefined, { ok: true });
    expect(screen.getByText(props.errorLabel)).toBeInTheDocument();
    const crossTab = { ...result, tabId: 'workspace-b', tabLabel: 'Second', lineNumber: 7, excerpt: 'guide excerpt', matchIndex: 2, matchOrdinal: 1 };
    rerender(<SearchDocumentPreview {...props} item={crossTab} />);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(request()).toMatchObject({ filePath: result.fsPath, tabId: 'workspace-b' });
    reply('<p>Stale</p>', { index: 0 });
    expect(screen.queryByText('Stale')).not.toBeInTheDocument();
    reply('<p>Fresh preview</p>');
    expect(screen.getByText('Fresh preview')).toBeInTheDocument();
    act(() => vi.runOnlyPendingTimers());
    expect(jump).toHaveBeenCalledWith(
      expect.any(HTMLElement), 'guide', 1, 2, '<p>Fresh preview</p>', true,
      { lineNumber: 7, excerpt: 'guide excerpt' },
    );
    expect(schedule).toHaveBeenCalledOnce();
    rerender(<SearchDocumentPreview {...props} item={{ ...crossTab }} />);
    expect(bridge.postMessage).toHaveBeenCalledTimes(2);
    unmount();
    expect(stop).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('dispatches embedded preview actions without navigating the document', () => {
    const ui = { copyCode: vi.fn(), toggleHtmlMode: vi.fn(), toggleCsvMode: vi.fn(), toggleCodeCollapse: vi.fn() };
    const table = { toggleViewDropdown: vi.fn(), switchView: vi.fn(), closeViewDropdown: vi.fn() };
    vi.stubGlobal('UI', ui);
    vi.stubGlobal('Table', table);
    const { props, reply } = fixture();
    render(<SearchDocumentPreview {...props} />);
    reply(`
      <button class="mdn-copy-btn"><span>Copy code</span></button>
      <button class="mdn-toggle-preview-btn">Toggle HTML</button>
      <button class="mdn-toggle-csv-btn">Toggle CSV</button>
      <button class="mdn-codeblock-toggle-btn">Toggle code</button>
      <div id="sample-view-dropdown" class="mdn-table-view-dropdown">
        <button class="mdn-table-view-select">Choose view</button>
        <button class="mdn-table-view-menu__option" data-value="chart">Chart</button>
        <button class="mdn-table-view-menu__option">No option</button>
      </div>
      <button class="mdn-table-view-select">No table</button>
      <a href="#part%20two">Go to part two</a>
      <a href="#missing">Missing section</a>
      <p id="part two">Part two</p>
    `);
    const actions = [
      ['Copy code', ui.copyCode], ['Toggle HTML', ui.toggleHtmlMode],
      ['Toggle CSV', ui.toggleCsvMode], ['Toggle code', ui.toggleCodeCollapse],
    ] as const;
    for (const [label, action] of actions) {
      const button = screen.getByRole('button', { name: label });
      expect(fireEvent.click(screen.getByText(label))).toBe(false);
      expect(action).toHaveBeenCalledExactlyOnceWith(button);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Choose view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chart' }));
    fireEvent.click(screen.getByRole('button', { name: 'No table' }));
    fireEvent.click(screen.getByRole('button', { name: 'No option' }));
    expect(table.toggleViewDropdown).toHaveBeenCalledExactlyOnceWith('sample', expect.any(MouseEvent));
    expect(table.switchView).toHaveBeenCalledExactlyOnceWith('sample', 'chart');
    expect(table.closeViewDropdown).toHaveBeenCalledExactlyOnceWith('sample');
    const part = screen.getByText('Part two');
    const scroll = vi.fn();
    part.scrollIntoView = scroll;
    vi.stubGlobal('CSS', { escape: (id: string) => id.replaceAll(' ', '\\ ') });
    expect(fireEvent.click(screen.getByRole('link', { name: 'Go to part two' }))).toBe(false);
    expect(fireEvent.click(screen.getByRole('link', { name: 'Missing section' }))).toBe(false);
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'start' });
    vi.stubGlobal('UI', undefined);
    vi.stubGlobal('Table', undefined);
    for (const [label, action] of actions) {
      expect(fireEvent.click(screen.getByRole('button', { name: label }))).toBe(false);
      expect(action).toHaveBeenCalledOnce();
    }
    expect(fireEvent.click(screen.getByRole('button', { name: 'Chart' }))).toBe(false);
    expect(fireEvent.click(screen.getByRole('button', { name: 'Choose view' }))).toBe(false);
    expect(table.switchView).toHaveBeenCalledOnce();
    expect(table.toggleViewDropdown).toHaveBeenCalledOnce();
  });

  it('scrolls to an existing outer fragment when the preview has no matching target', () => {
    const { props, reply } = fixture();
    render(<><p id="outside">Outer target</p><SearchDocumentPreview {...props} /></>);
    reply('<a href="#outside">Go outside</a>');
    const scroll = vi.fn();
    screen.getByText('Outer target').scrollIntoView = scroll;
    vi.stubGlobal('CSS', { escape: (id: string) => id });
    expect(fireEvent.click(screen.getByRole('link', { name: 'Go outside' }))).toBe(false);
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'start' });
  });
});
