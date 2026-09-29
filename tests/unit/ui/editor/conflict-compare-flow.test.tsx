import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOCUMENT_COMPARE_REQUEST_EVENT,
  useDocumentConflictResolution,
} from '../../../../ui/src/editor/useDocumentConflictResolution';
import type { EditableDocumentSession } from '../../../../ui/src/editor/documentSession';
import { getEditorUiTranslations } from '../../../../ui/src/contexts/editorUiTranslations';

function conflictSession(filePath: string, diskRevision = '20:6'): EditableDocumentSession {
  return {
    filePath,
    source: '# Mine',
    persistedSource: '# A',
    lineEnding: '\n',
    revision: '10:3',
    mode: 'plain',
    saveState: 'conflict',
    pendingSaveSource: null,
    conflict: { diskSource: '# Disk', diskRevision, diskLineEnding: '\n' },
  } as EditableDocumentSession;
}

interface HarnessProps {
  readonly sessions: Readonly<Record<string, EditableDocumentSession>>;
  readonly dispatch: React.Dispatch<never>;
  readonly language?: string;
}

function Harness({ sessions, dispatch, language }: HarnessProps) {
  const { conflictModal } = useDocumentConflictResolution({
    sessions,
    dispatch: dispatch as never,
    saveDocument: vi.fn(async () => null),
    language,
  });
  return <>{conflictModal}</>;
}

describe('document conflict compare flow', () => {
  let compare: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    compare = vi.fn();
    window.addEventListener(DOCUMENT_COMPARE_REQUEST_EVENT, compare);
  });
  afterEach(() => {
    window.removeEventListener(DOCUMENT_COMPARE_REQUEST_EVENT, compare);
  });

  it('activates the conflicting file before requesting the diff', async () => {
    const dispatch = vi.fn();
    const filePath = '/docs/other.md';
    render(<Harness sessions={{ [filePath]: conflictSession(filePath) }} dispatch={dispatch} />);

    await userEvent.click(screen.getByRole('button', { name: 'Compare changes' }));

    expect(dispatch).toHaveBeenCalledWith({ type: 'ACTIVATE_CONTENT_TAB', filePath });
    await vi.waitFor(() => expect(compare).toHaveBeenCalledTimes(1));
    expect((compare.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      filePath, leftSource: '# Disk', rightSource: '# Mine',
    });
    expect(dispatch.mock.invocationCallOrder[0]).toBeLessThan(compare.mock.invocationCallOrder[0]);
  });

  it('hides the modal while comparing and shows a non-modal return banner', async () => {
    const filePath = '/docs/a.md';
    render(<Harness sessions={{ [filePath]: conflictSession(filePath) }} dispatch={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Compare changes' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const banner = screen.getByRole('region', { name: /a\.md changed on disk/i });
    expect(banner).not.toHaveAttribute('aria-modal');
    expect(screen.getByRole('button', { name: 'Back to conflict resolution' })).toBeInTheDocument();
  });

  it('re-shows the modal when returning to conflict resolution', async () => {
    const filePath = '/docs/a.md';
    render(<Harness sessions={{ [filePath]: conflictSession(filePath) }} dispatch={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Compare changes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to conflict resolution' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to conflict resolution' })).not.toBeInTheDocument();
  });

  it('lets the user resolve directly from the banner', async () => {
    const dispatch = vi.fn();
    const filePath = '/docs/a.md';
    render(<Harness sessions={{ [filePath]: conflictSession(filePath) }} dispatch={dispatch} />);

    await userEvent.click(screen.getByRole('button', { name: 'Compare changes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reload disk version' }));

    expect(dispatch).toHaveBeenCalledWith({ type: 'RESOLVE_DOCUMENT_CONFLICT_RELOAD', filePath });
  });

  it('shows the modal again when a new disk revision conflicts', async () => {
    const filePath = '/docs/a.md';
    const dispatch = vi.fn();
    const { rerender } = render(<Harness sessions={{ [filePath]: conflictSession(filePath) }} dispatch={dispatch} />);

    await userEvent.click(screen.getByRole('button', { name: 'Compare changes' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      rerender(<Harness sessions={{ [filePath]: conflictSession(filePath, '40:9') }} dispatch={dispatch} />);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('localizes the modal and banner labels', async () => {
    const t = getEditorUiTranslations('vi');
    const filePath = '/docs/a.md';
    render(<Harness sessions={{ [filePath]: conflictSession(filePath) }} dispatch={vi.fn()} language="vi" />);

    expect(screen.getByRole('heading', { name: t.conflictTitle.replace('{fileName}', 'a.md') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.conflictReload })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.conflictKeepMine })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.conflictCompare }));
    expect(screen.getByRole('button', { name: t.conflictBackToResolution })).toBeInTheDocument();
    expect(t.conflictBackToResolution).not.toBe(getEditorUiTranslations('en').conflictBackToResolution);
  });
});
