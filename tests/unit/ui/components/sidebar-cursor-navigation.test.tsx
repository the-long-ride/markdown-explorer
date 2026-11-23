import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useSidebarCursorNavigation } from '../../../../ui/src/components/Sidebar/useSidebarCursorNavigation';

const selectedFilePaths = new Set<string>();

function Tree({
  open = true, currentFile, filter = '', onClose, onFolder, onFile,
}: {
  open?: boolean;
  currentFile?: string;
  filter?: string;
  onClose?: () => void;
  onFolder?: () => void;
  onFile?: () => void;
}) {
  const treeRef = useRef<HTMLDivElement>(null);
  const cursor = useSidebarCursorNavigation({
    cursorMode: open, treeRef, currentFile, filter,
    hideUnselected: false, scopeFocusEditing: false, selectedFilePaths, onCursorModeClose: onClose,
  });
  const setScroll = (node: HTMLButtonElement | null) => {
    if (node) node.scrollIntoView = vi.fn();
  };
  return <>
    <button type="button">Outside</button>
    <div ref={treeRef}>
      <label>Filter<input /></label>
      <span role="textbox" aria-label="Editor" contentEditable ref={node => {
        if (node) Object.defineProperty(node, 'isContentEditable', { configurable: true, value: true });
      }} />
      <output aria-label="Cursor">{cursor ?? 'None'}</output>
      {filter !== 'empty' && <button type="button" ref={setScroll} data-sidebar-cursor-item="true" data-sidebar-id="folder" data-sidebar-kind="directory" onClick={onFolder}>Folder</button>}
      {!filter && <button type="button" ref={setScroll} data-sidebar-cursor-item="true" data-sidebar-id="a.md" data-sidebar-kind="file" onClick={onFile}>A</button>}
    </div>
  </>;
}

describe('sidebar cursor navigation', () => {
  it('starts on the open file, clamps the cursor, and opens selected rows', () => {
    const onClose = vi.fn();
    const onFolder = vi.fn();
    const onFile = vi.fn();
    render(<Tree currentFile="a.md" onClose={onClose} onFolder={onFolder} onFile={onFile} />);
    const file = screen.getByRole('button', { name: 'A' });
    const folder = screen.getByRole('button', { name: 'Folder' });
    expect(file).toHaveFocus();
    expect(file.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    fireEvent.keyDown(file, { key: 'ArrowDown' });
    expect(file).toHaveFocus();
    fireEvent.keyDown(file, { key: 'ArrowUp' });
    fireEvent.keyDown(folder, { key: 'ArrowUp' });
    expect(folder).toHaveFocus();
    fireEvent.keyDown(folder, { key: 'Enter' });
    expect(onFolder).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(folder, { key: 'ArrowDown' });
    fireEvent.keyDown(file, { key: 'Enter' });
    expect(onFile).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('respects editable targets and closes only on outside clicks or Escape', () => {
    const onClose = vi.fn();
    render(<Tree onClose={onClose} />);
    const input = screen.getByRole('textbox', { name: 'Filter' });
    const folder = screen.getByRole('button', { name: 'Folder' });
    input.focus();
    expect(fireEvent.keyDown(input, { key: 'ArrowDown' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true);
    expect(input).toHaveFocus();
    fireEvent.pointerDown(folder);
    fireEvent.keyDown(folder, { key: 'Space' });
    expect(onClose).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false);
    expect(fireEvent.keyDown(folder, { key: 'Escape' })).toBe(false);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('leaves contenteditable keystrokes and already handled events alone', () => {
    const onFile = vi.fn();
    render(<Tree currentFile="a.md" onFile={onFile} />);
    const editor = screen.getByRole('textbox', { name: 'Editor' });
    expect(fireEvent.keyDown(editor, { key: 'Enter' })).toBe(true);
    const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    key.preventDefault();
    fireEvent(screen.getByRole('button', { name: 'A' }), key);
    expect(onFile).not.toHaveBeenCalled();
  });

  it('does not cancel navigation keys when an open cursor has no visible rows', () => {
    const onClose = vi.fn();
    render(<Tree filter="empty" onClose={onClose} />);
    expect(fireEvent.keyDown(document, { key: 'ArrowDown' })).toBe(true);
    expect(fireEvent.keyDown(document, { key: 'Enter' })).toBe(true);
    expect(screen.getByLabelText('Cursor')).toHaveTextContent('None');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('refocuses visible rows when filtering, then clears the cursor in an empty or closed tree', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Tree currentFile="a.md" onClose={onClose} />);
    expect(screen.getByLabelText('Cursor')).toHaveTextContent('a.md');
    rerender(<Tree currentFile="a.md" filter="folder" onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Folder' })).toHaveFocus();
    rerender(<Tree currentFile="a.md" filter="empty" onClose={onClose} />);
    expect(screen.getByLabelText('Cursor')).toHaveTextContent('None');
    expect(fireEvent.keyDown(document, { key: 'Enter' })).toBe(true);
    rerender(<Tree open={false} onClose={onClose} />);
    expect(screen.getByLabelText('Cursor')).toHaveTextContent('None');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
