import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileHistoryModal, nextComparePicks } from '../../../../ui/src/components/History/FileHistoryModal';
import { getHistoryTranslations } from '../../../../ui/src/contexts/historyTranslations';
import { getFileHistoryTranslations } from '../../../../ui/src/contexts/fileHistoryTranslations';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import type { GitRevisionSummary } from '../../../../ui/src/history/contracts';
import type { HistoryClient } from '../../../../ui/src/history/historyClient';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

function entry(index: number, overrides: Partial<GitRevisionSummary> = {}): GitRevisionSummary {
  const oid = (index + 1).toString(16).padStart(40, '0');
  return { oid, shortOid: oid.slice(0, 7), author: `Dev ${index}`, authoredAt: '2026-09-13T00:00:00Z', subject: `commit ${index}`, path: 'docs/a.md', ...overrides };
}

function createClient(entries: readonly GitRevisionSummary[]): HistoryClient {
  return {
    listDocumentHistory: vi.fn().mockResolvedValue(entries),
    readGitRevision: vi.fn().mockImplementation(async (oid: string, path: string) => ({ oid, path, source: 'added text' })),
    compareGitRevisions: vi.fn().mockImplementation(async (left: { oid?: string }, right: { oid?: string; kind: string }) => ({
      leftSource: `old ${left.oid?.slice(-1)}`,
      rightSource: right.kind === 'current' ? 'disk text' : `new ${right.oid?.slice(-1)}`,
    })),
    listRepositoryHistory: vi.fn(),
    listRevisionFiles: vi.fn(),
    readRevisionFile: vi.fn(),
    dispose: vi.fn(),
  };
}

function createBridge(initial: Record<string, unknown> = {}) {
  let stored = initial;
  return {
    postMessage: vi.fn(),
    onMessage: vi.fn(() => () => undefined),
    getState: vi.fn(() => stored),
    setState: vi.fn((next: Record<string, unknown>) => { stored = next; }),
    copyToClipboard: vi.fn(),
  } as unknown as PlatformBridge & { setState: ReturnType<typeof vi.fn> };
}

function renderModal(entries = [entry(0), entry(1), entry(2)], bridge = createBridge(), onClose = vi.fn()) {
  const client = createClient(entries);
  render(<PlatformProvider bridge={bridge}><FileHistoryModal filePath="docs/a.md" client={client} language="en" currentSource={() => null} onClose={onClose} bridge={bridge} /></PlatformProvider>);
  return { client, bridge, onClose };
}

const rowFor = (subject: string) => screen.getByRole('button', { name: new RegExp(subject) });

describe('FileHistoryModal', () => {
  it('orders range endpoints correctly when the older commit is picked first', async () => {
    const { client } = renderModal();
    await screen.findByText('commit 0');
    fireEvent.click(screen.getByRole('button', { name: /compare/i }));
    fireEvent.click(within(rowFor('commit 2').closest('li')!).getByRole('checkbox'));
    fireEvent.click(within(rowFor('commit 0').closest('li')!).getByRole('checkbox'));
    const olderOid = entry(2).oid;
    const newerOid = entry(0).oid;
    await waitFor(() => expect(client.compareGitRevisions).toHaveBeenLastCalledWith(
      expect.objectContaining({ oid: olderOid }), expect.objectContaining({ oid: newerOid }),
    ));
  });
  it('shows an invalid authored date and substitutes the short SHA for a missing subject', async () => {
    renderModal([entry(0, { subject: '', shortOid: 'a1b2c3d', authoredAt: 'Archived (date unknown)' })]);
    const row = await screen.findByRole('button', { name: /a1b2c3d.*Archived \(date unknown\)/i });
    expect(row).toBeVisible();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a1b2c3d' } });
    expect(row).toBeVisible();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'does not match' } });
    expect(row).not.toBeInTheDocument();
  });

  it('opens with the commit list and the latest commit diff in raw inline view', async () => {
    const { client } = renderModal();

    expect(screen.getByRole('dialog', { name: /file history/i })).toBeInTheDocument();
    expect(await screen.findByText('commit 0')).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('.source-diff-view')).not.toBeNull());
    expect(client.compareGitRevisions).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Raw' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Inline' })).toHaveAttribute('aria-pressed', 'true');
    expect(rowFor('commit 0')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the diff of a clicked commit', async () => {
    const { client } = renderModal();
    await screen.findByText('commit 1');

    await userEvent.click(rowFor('commit 1'));

    await waitFor(() => expect(rowFor('commit 1')).toHaveAttribute('aria-pressed', 'true'));
    expect(client.compareGitRevisions).toHaveBeenLastCalledWith(
      expect.objectContaining({ oid: entry(2).oid }),
      expect.objectContaining({ oid: entry(1).oid }),
    );
  });

  it('compares two picked commits and replaces the older pick with a third', async () => {
    const entries = [entry(0), entry(1), entry(2), entry(3)];
    const { client } = renderModal(entries);
    await screen.findByText('commit 3');

    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /commit 0/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /commit 2/ }));
    await waitFor(() => expect(client.compareGitRevisions).toHaveBeenLastCalledWith(
      expect.objectContaining({ oid: entries[2].oid }),
      expect.objectContaining({ oid: entries[0].oid }),
    ));

    await userEvent.click(screen.getByRole('checkbox', { name: /commit 1/ }));
    expect(screen.getByRole('checkbox', { name: /commit 2/ })).toHaveAttribute('aria-checked', 'false');
    // commit 1 → commit 0 was fetched on open, so it comes from the cache.
    await waitFor(() => expect(screen.getByText('old 2')).toBeInTheDocument());
    expect(screen.getByText('new 1')).toBeInTheDocument();
  });

  it('follows Option 3 boundary replacement across V4..V1 compare toggles and portals checkbox tooltips', async () => {
    // Entries ordered latest -> oldest: [V4, V3, V2, V1]
    const entries = [
      entry(0, { subject: 'V4' }),
      entry(1, { subject: 'V3' }),
      entry(2, { subject: 'V2' }),
      entry(3, { subject: 'V1' }),
    ];
    renderModal(entries);
    await screen.findByText('V1');

    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));
    const box = (name: 'V4' | 'V3' | 'V2' | 'V1') => screen.getByRole('checkbox', { name: new RegExp(`Compare: ${name}$`) });
    const checkedState = () => (['V4', 'V3', 'V2', 'V1'] as const).filter((name) => box(name).getAttribute('aria-checked') === 'true');

    // Start: check V3 and V2
    await userEvent.click(box('V3'));
    await userEvent.click(box('V2'));
    expect(checkedState()).toEqual(['V3', 'V2']);

    // Check V4 (above both) -> moves V3 to V4 => [V4, V2]
    await userEvent.click(box('V4'));
    expect(checkedState()).toEqual(['V4', 'V2']);

    // Check V1 (below both) -> moves V2 to V1 => [V4, V1]
    await userEvent.click(box('V1'));
    expect(checkedState()).toEqual(['V4', 'V1']);

    // Check V3 (inside) -> moves V1 to V3 => [V4, V3]
    await userEvent.click(box('V3'));
    expect(checkedState()).toEqual(['V4', 'V3']);

    // Check V1 (below both) -> moves V3 to V1 => [V4, V1]
    await userEvent.click(box('V1'));
    expect(checkedState()).toEqual(['V4', 'V1']);

    // Check V3 (inside again) -> alternates to move V4 to V3 => [V3, V1]
    await userEvent.click(box('V3'));
    expect(checkedState()).toEqual(['V3', 'V1']);

    // Checkbox uses shared SVG icon & left-aligned portal tooltip
    const firstBox = box('V4');
    expect(firstBox).toHaveAttribute('data-tooltip-align', 'left');
    fireEvent.mouseEnter(firstBox);
    await waitFor(() => {
      const portal = document.body.querySelector('.tooltip-portal');
      expect(portal).not.toBeNull();
      expect(portal?.textContent).toContain('Compare: V4');
    });
  });

  it('compares the selected commit with the current file from the pinned row', async () => {
    const { client } = renderModal();
    await screen.findByText('commit 0');

    await userEvent.click(screen.getByRole('button', { name: /current file/i }));

    await waitFor(() => expect(client.compareGitRevisions).toHaveBeenLastCalledWith(
      expect.objectContaining({ oid: entry(0).oid }),
      { kind: 'current', path: 'docs/a.md' },
    ));
  });

  it('switches views and remembers the choice in bridge state', async () => {
    const bridge = createBridge({ theme: 'dark' });
    renderModal(undefined, bridge);
    await waitFor(() => expect(document.querySelector('.source-diff-view')).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Split' }));
    expect(document.querySelector('.split-source-diff-view')).not.toBeNull();
    expect(bridge.setState).toHaveBeenLastCalledWith({ theme: 'dark', fileHistoryView: 'raw-split' });

    await userEvent.click(screen.getByRole('button', { name: 'Rendered' }));
    expect(document.querySelector('.rendered-diff-view')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Split' })).toBeNull();
    expect(bridge.setState).toHaveBeenLastCalledWith({ theme: 'dark', fileHistoryView: 'rendered' });
  });

  it('opens in the remembered view', async () => {
    renderModal(undefined, createBridge({ fileHistoryView: 'raw-split' }));
    await waitFor(() => expect(document.querySelector('.split-source-diff-view')).not.toBeNull());
  });

  it('copies the full commit SHA from a row', async () => {
    const { bridge } = renderModal();
    await screen.findByText('commit 0');
    await userEvent.click(screen.getAllByRole('button', { name: /copy commit sha/i })[0]);
    expect(bridge.copyToClipboard).toHaveBeenCalledWith(entry(0).oid);
  });

  it('marks a commit that renamed the file', async () => {
    renderModal([entry(0, { path: 'docs/new.md' }), entry(1, { path: 'docs/old.md' })]);
    const row = (await screen.findByText('commit 0')).closest('li')!;
    expect(within(row).getByText(/renamed from docs\/old\.md/i)).toBeInTheDocument();
  });

  it('filters commits by subject, author or hash', async () => {
    renderModal();
    await screen.findByText('commit 2');

    await userEvent.type(screen.getByRole('searchbox', { name: /filter commits/i }), 'dev 2');

    expect(screen.getByText('commit 2')).toBeInTheDocument();
    expect(screen.queryByText('commit 0')).toBeNull();
  });

  it('shows an unsupported repository message with retry', async () => {
    const client = createClient([entry(0)]);
    vi.mocked(client.listDocumentHistory).mockRejectedValueOnce(new Error('not-repository'));
    const bridge = createBridge();
    render(<PlatformProvider bridge={bridge}><FileHistoryModal filePath="docs/a.md" client={client} language="en" currentSource={() => null} onClose={vi.fn()} bridge={bridge} /></PlatformProvider>);

    expect(await screen.findByText(/not inside a git repository/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('commit 0')).toBeInTheDocument();
  });

  it.each([
    ['unsupported-runtime', getHistoryTranslations('en').unsupportedRuntime],
    ['git-unavailable', getHistoryTranslations('en').gitUnavailable],
    ['History request timed out', getFileHistoryTranslations('en').timeout],
    ['Host rejected this path', 'Host rejected this path'],
  ])('reports the history failure %s and allows closing from the backdrop', async (reason, message) => {
    const client = createClient([]);
    vi.mocked(client.listDocumentHistory).mockRejectedValueOnce(new Error(reason));
    const bridge = createBridge();
    const onClose = vi.fn();
    render(<PlatformProvider bridge={bridge}><FileHistoryModal filePath="docs/a.md" client={client} language="en" currentSource={() => null} onClose={onClose} bridge={bridge} /></PlatformProvider>);
    expect(await screen.findByRole('status')).toHaveTextContent(message);
    fireEvent.click(screen.getByText(message));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('reports an empty history, with Compare disabled', async () => {
    renderModal([]);
    expect(await screen.findByRole('status')).toHaveTextContent(getFileHistoryTranslations('en').noFileHistory);
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();
  });

  it('falls back to raw inline history with no persisted state and stores a new view', async () => {
    const client = createClient([entry(0)]);
    const bridge = createBridge();
    vi.mocked(bridge.getState).mockReturnValue(undefined);
    render(<PlatformProvider bridge={bridge}><FileHistoryModal filePath="C:\\docs\\a.md" client={client} currentSource={() => ''} onClose={vi.fn()} bridge={bridge} /></PlatformProvider>);
    expect(screen.getByRole('dialog', { name: /file history.*a\.md/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Inline' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Split' }));
    expect(bridge.setState).toHaveBeenLastCalledWith({ fileHistoryView: 'raw-split' });
  });

  it.each([
    [['old', 'new'], 'older', ['new', 'older']],
    [['new', 'old'], 'newer', ['newer', 'old']],
    [['old', 'stale'], 'middle', ['stale', 'middle']],
    [['new', 'stale'], 'unlisted', ['stale', 'unlisted']],
    [['stale', 'old'], 'middle', ['stale', 'middle']],
  ])('updates compare boundaries for %j when picking %s', (picks, oid, expected) => {
    const entries = ['newer', 'new', 'middle', 'old', 'older'].map(oid => ({ oid }));
    expect(nextComparePicks(entries, picks, oid, 'older')).toEqual({ picks: expected, nextInsideSide: 'older' });
  });

  it('shows the file as added for its first commit', async () => {
    renderModal([entry(0)]);
    expect(await screen.findByText(/file added in this commit/i)).toBeInTheDocument();
  });

  it('closes with Escape and with the close button', async () => {
    const onClose = vi.fn();
    renderModal(undefined, createBridge(), onClose);
    await screen.findByText('commit 0');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves focus into the dialog, traps Tab, and restores focus on close', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'History';
    document.body.appendChild(trigger);
    trigger.focus();
    const bridge = createBridge();
    const client = createClient([entry(0), entry(1)]);
    const { unmount } = render(<PlatformProvider bridge={bridge}><FileHistoryModal filePath="docs/a.md" client={client} language="en" currentSource={() => null} onClose={vi.fn()} bridge={bridge} /></PlatformProvider>);
    await screen.findByText('commit 0');

    const dialog = screen.getByRole('dialog', { name: /file history/i });
    const close = screen.getByRole('button', { name: /close/i });
    expect(close).toHaveFocus();

    const focusables = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(focusables[0]).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(focusables[focusables.length - 1]).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('resizes the commit list and the split panes from the keyboard and remembers the layout', async () => {
    const bridge = createBridge({ theme: 'dark' });
    renderModal(undefined, bridge);
    await waitFor(() => expect(document.querySelector('.source-diff-view')).not.toBeNull());

    const list = screen.getByRole('separator', { name: /resize commit list/i });
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(list).toHaveAttribute('aria-valuenow', '296');
    expect(document.querySelector<HTMLElement>('.file-history__card')!.style.getPropertyValue('--file-history-list-width')).toBe('296px');
    expect(screen.queryByRole('separator', { name: /resize diff panes/i })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Split' }));
    const split = screen.getByRole('separator', { name: /resize diff panes/i });
    fireEvent.keyDown(split, { key: 'ArrowLeft', shiftKey: true });
    expect(split).toHaveAttribute('aria-valuenow', '42');

    await waitFor(() => expect(bridge.setState).toHaveBeenLastCalledWith(expect.objectContaining({
      theme: 'dark', fileHistoryLayout: { listWidth: 296, splitRatio: 0.42 },
    })));
    fireEvent.doubleClick(split);
    expect(split).toHaveAttribute('aria-valuenow', '50');
  });

  it('requests the next history page only when scrolling near the bottom', async () => {
    const entries = Array.from({ length: 150 }, (_, index) => entry(index));
    const client = createClient(entries.slice(0, 100));
    vi.mocked(client.listDocumentHistory).mockResolvedValueOnce(entries.slice(0, 100)).mockResolvedValue(entries);
    const bridge = createBridge();
    render(<PlatformProvider bridge={bridge}><FileHistoryModal filePath="docs/a.md" client={client} language="en" currentSource={() => null} onClose={vi.fn()} bridge={bridge} /></PlatformProvider>);
    await screen.findByText('commit 99');
    const list = screen.getByText('commit 99').closest('ol')!;
    Object.defineProperties(list, {
      scrollHeight: { value: 1000, configurable: true },
      clientHeight: { value: 200, configurable: true },
    });
    fireEvent.scroll(list, { target: { scrollTop: 120 } });
    expect(client.listDocumentHistory).toHaveBeenCalledExactlyOnceWith('docs/a.md', 100);
    fireEvent.scroll(list, { target: { scrollTop: 800 } });
    expect(await screen.findByText('commit 149')).toBeVisible();
    expect(client.listDocumentHistory).toHaveBeenLastCalledWith('docs/a.md', 200);
    fireEvent.scroll(list);
    expect(client.listDocumentHistory).toHaveBeenCalledTimes(2);
  });

  it('resizes a measured split diff and ignores drags until its guide has usable width', async () => {
    renderModal(undefined, createBridge({ fileHistoryView: 'raw-split' }));
    const handle = await screen.findByRole('separator', { name: /resize diff panes/i });
    const guide = handle.parentElement!;
    const pointer = (type: string, x: number) => Object.assign(new MouseEvent(type, { bubbles: true, clientX: x }), { pointerId: 4 });
    fireEvent(handle, pointer('pointerdown', 240));
    fireEvent(handle, pointer('pointermove', 330));
    expect(handle).toHaveAttribute('aria-valuenow', '50');
    Object.defineProperty(guide, 'clientWidth', { value: 424, configurable: true });
    vi.spyOn(guide, 'getBoundingClientRect').mockReturnValue(new DOMRect(80, 0, 424, 500));
    fireEvent(handle, pointer('pointermove', 330));
    expect(handle).not.toHaveAttribute('aria-valuenow', '50');
    fireEvent(handle, pointer('pointerup', 330));
  });

  it('drags the commit list from its left edge, ignores a secondary-button press, and ends on pointer cancellation', async () => {
    renderModal();
    await screen.findByText('commit 0');
    const handle = screen.getByRole('separator', { name: /resize commit list/i });
    vi.spyOn(handle.parentElement!, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 0, 280, 500));
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.assign(handle, { setPointerCapture, hasPointerCapture: () => true, releasePointerCapture });
    const pointer = (type: string, x: number, button = 0) => Object.assign(
      new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button }), { pointerId: 3 },
    );
    fireEvent(handle, pointer('pointerdown', 380, 2));
    expect(setPointerCapture).not.toHaveBeenCalled();
    fireEvent(handle, pointer('pointerdown', 380));
    expect(handle).toHaveClass('is-dragging');
    expect(setPointerCapture).toHaveBeenCalledWith(3);
    fireEvent(handle, pointer('pointermove', 430));
    expect(handle).toHaveAttribute('aria-valuenow', '330');
    fireEvent(handle, pointer('pointercancel', 430));
    expect(handle).not.toHaveClass('is-dragging');
    expect(document.body).not.toHaveClass('is-file-history-resizing');
    expect(releasePointerCapture).toHaveBeenCalledWith(3);
    fireEvent(handle, pointer('pointermove', 480));
    expect(handle).toHaveAttribute('aria-valuenow', '330');
  });

  it('restores a remembered layout within bounds', async () => {
    renderModal(undefined, createBridge({ fileHistoryLayout: { listWidth: 900, splitRatio: 0.3 }, fileHistoryView: 'raw-split' }));
    await waitFor(() => expect(document.querySelector('.split-source-diff-view')).not.toBeNull());
    expect(screen.getByRole('separator', { name: /resize commit list/i })).toHaveAttribute('aria-valuenow', '560');
    expect(screen.getByRole('separator', { name: /resize diff panes/i })).toHaveAttribute('aria-valuenow', '30');
  });

  it('shows side labels in the toolbar and view controls in the header', async () => {
    renderModal();
    await waitFor(() => expect(document.querySelector('.source-diff-view')).not.toBeNull());
    const toolbar = document.querySelector<HTMLElement>('.file-history__toolbar')!;
    expect(within(toolbar).getAllByText(/^(Left|Right) — /)).toHaveLength(2);
    expect(document.querySelector('.file-history__diff-body .document-diff-view__labels')).toBeNull();
    const header = document.querySelector<HTMLElement>('.file-history__header')!;
    expect(within(header).getByRole('button', { name: 'Raw' })).toBeInTheDocument();
  });
});
