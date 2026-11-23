import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DocumentConflictBanner, DocumentConflictModal } from '../../../../ui/src/components/Modal/DocumentConflictModal';
import { getEditorUiTranslations } from '../../../../ui/src/contexts/editorUiTranslations';

describe('document conflict modal', () => {
  const conflict = { diskSource: '# Disk', diskRevision: '2:6' };

  it('invokes keep mine only from the explicit force-save choice', async () => {
    const onKeepMine = vi.fn();
    render(<DocumentConflictModal fileName="a.md" conflict={conflict} onKeepMine={onKeepMine} onReload={vi.fn()} onCompare={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Keep my edit' }));
    expect(onKeepMine).toHaveBeenCalledTimes(1);
  });

  it('keeps reload and compare as distinct actions', async () => {
    const onReload = vi.fn();
    const onCompare = vi.fn();
    render(<DocumentConflictModal fileName="a.md" conflict={conflict} onKeepMine={vi.fn()} onReload={onReload} onCompare={onCompare} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reload disk version' }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onCompare).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Compare changes' }));
    expect(onCompare).toHaveBeenCalledTimes(1);
  });

  it('styles its actions with the shared button classes and focuses Compare on open', () => {
    render(<DocumentConflictModal fileName="a.md" conflict={conflict} onKeepMine={vi.fn()} onReload={vi.fn()} onCompare={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Compare changes' })).toHaveClass('btn', 'btn--primary');
    expect(screen.getByRole('button', { name: 'Reload disk version' })).toHaveClass('btn');
    expect(screen.getByRole('button', { name: 'Compare changes' })).toHaveFocus();
  });

  it('traps Tab focus at both dialog edges and restores focus to the opener', () => {
    const { rerender } = render(<button type="button">Open resolution</button>);
    const opener = screen.getByRole('button', { name: 'Open resolution' });
    opener.focus();
    rerender(<>
      <button type="button">Open resolution</button>
      <DocumentConflictModal fileName="a.md" conflict={conflict} onKeepMine={vi.fn()} onReload={vi.fn()} onCompare={vi.fn()} />
    </>);
    const first = screen.getByRole('button', { name: 'Reload disk version' });
    const last = screen.getByRole('button', { name: 'Keep my edit' });
    const compare = screen.getByRole('button', { name: 'Compare changes' });
    expect(compare).toHaveFocus();
    expect(fireEvent.keyDown(compare, { key: 'Tab' })).toBe(true);
    last.focus();
    expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false);
    expect(first).toHaveFocus();
    expect(fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(last).toHaveFocus();
    opener.focus();
    expect(fireEvent.keyDown(opener, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(last).toHaveFocus();
    opener.focus();
    expect(fireEvent.keyDown(opener, { key: 'Tab' })).toBe(false);
    expect(first).toHaveFocus();
    rerender(<button type="button">Open resolution</button>);
    expect(opener).toHaveFocus();
  });

  it('keeps return, reload, and keep-mine actions available in the non-modal comparison banner', () => {
    const t = getEditorUiTranslations('fr');
    const onReturn = vi.fn();
    const onReload = vi.fn();
    const onKeepMine = vi.fn();
    render(<DocumentConflictBanner fileName="a.md" language="fr" onReturn={onReturn} onReload={onReload} onKeepMine={onKeepMine} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const banner = within(screen.getByRole('region', { name: t.conflictTitle.replace('{fileName}', 'a.md') }));
    expect(banner.getByRole('status')).toHaveTextContent(t.conflictComparing);
    fireEvent.click(banner.getByRole('button', { name: t.conflictBackToResolution }));
    expect(onReturn).toHaveBeenCalledOnce();
    expect(onReload).not.toHaveBeenCalled();
    expect(onKeepMine).not.toHaveBeenCalled();
    fireEvent.click(banner.getByRole('button', { name: t.conflictReload }));
    fireEvent.click(banner.getByRole('button', { name: t.conflictKeepMine }));
    expect(onReload).toHaveBeenCalledOnce();
    expect(onKeepMine).toHaveBeenCalledOnce();
  });

  it('renders every label from the editor translations for the given language', () => {
    const t = getEditorUiTranslations('fr');
    render(<DocumentConflictModal fileName="a.md" conflict={conflict} language="fr" onKeepMine={vi.fn()} onReload={vi.fn()} onCompare={vi.fn()} />);
    expect(screen.getByRole('heading', { name: t.conflictTitle.replace('{fileName}', 'a.md') })).toBeInTheDocument();
    expect(screen.getByText(t.conflictMessage)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.conflictReload })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.conflictCompare })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.conflictKeepMine })).toBeInTheDocument();
    expect(screen.getByText(t.conflictDiskRevision.replace('{revision}', '2:6'))).toBeInTheDocument();
    expect(screen.queryByText('Keep my edit')).not.toBeInTheDocument();
  });
});
