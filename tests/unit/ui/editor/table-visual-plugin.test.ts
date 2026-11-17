import { describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history } from '@codemirror/commands';
import { createTableVisualExtension } from '../../../../ui/src/editor/tableVisualPlugin';

describe('tableVisualPlugin', () => {
  const sampleDoc = [
    '# Title',
    '',
    '| Header 1 | Header 2 |',
    '| --- | --- |',
    '| Cell 1 | Cell 2 |',
    '',
    'Footer text',
  ].join('\n');

  it('renders visual table widget in place of markdown table block', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: sampleDoc,
        extensions: [createTableVisualExtension(() => 'en')],
      }),
      parent,
    });

    const widget = parent.querySelector('[data-testid="cm-table-widget"]');
    expect(widget).not.toBeNull();

    const headers = parent.querySelectorAll('.cm-table-cell--header');
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toBe('Header 1');
    expect(headers[1].textContent).toBe('Header 2');

    const cells = parent.querySelectorAll('tbody .cm-table-cell');
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toBe('Cell 1');
    expect(cells[1].textContent).toBe('Cell 2');

    const info = parent.querySelector('.cm-table-widget__info');
    expect(info?.textContent).toBe('Row 1 × 2 Columns');

    const toggleBtn = parent.querySelector('.cm-table-widget__toggle-btn');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn?.classList.contains('tooltip-container')).toBe(true);
    expect(toggleBtn?.querySelector('.tooltip-text')?.textContent).toBe('View raw Markdown');
    expect(toggleBtn?.querySelector('svg')).not.toBeNull();

    view.destroy();
    parent.remove();
  });

  it('updates document when cell is blurred with edited text', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: sampleDoc,
        extensions: [createTableVisualExtension(() => 'en')],
      }),
      parent,
    });

    const cell = parent.querySelector('tbody .cm-table-cell') as HTMLElement;
    expect(cell).not.toBeNull();

    cell.textContent = 'Updated Cell 1';
    cell.dispatchEvent(new Event('blur'));

    expect(view.state.doc.toString()).toContain('Updated Cell 1');

    view.destroy();
    parent.remove();
  });

  it('opens context menu on cell right-click and supports CRUD actions', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: sampleDoc,
        extensions: [createTableVisualExtension(() => 'en')],
      }),
      parent,
    });

    const cell = parent.querySelector('tbody .cm-table-cell') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));

    const menu = document.querySelector('.cm-table-context-menu');
    expect(menu).not.toBeNull();

    const buttons = Array.from(menu!.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      expect(btn.querySelector('.cm-table-context-menu__item-icon svg')).not.toBeNull();
    }
    const insertRowBelow = buttons.find((b) => b.textContent?.includes('Insert row below'));
    expect(insertRowBelow).toBeDefined();

    const insertLineBelow = buttons.find((b) => b.textContent?.includes('Insert line below table'));
    expect(insertLineBelow).toBeDefined();

    insertRowBelow?.click();

    // Context menu removes itself and table now has 2 data rows
    expect(document.querySelector('.cm-table-context-menu')).toBeNull();
    const rows = parent.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    view.destroy();
    parent.remove();
  });

  it('toggles raw markdown view and back', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: sampleDoc,
        extensions: [createTableVisualExtension(() => 'en')],
      }),
      parent,
    });

    const toggleBtn = parent.querySelector('.cm-table-widget__toggle-btn') as HTMLElement;
    expect(toggleBtn).not.toBeNull();
    toggleBtn.click();

    // Should now show raw table banner button
    const bannerBtn = parent.querySelector('.cm-raw-table-banner__btn') as HTMLElement;
    expect(bannerBtn).not.toBeNull();
    expect(bannerBtn.querySelector('svg')).not.toBeNull();

    // Clicking banner switches back to visual table
    bannerBtn.click();
    expect(parent.querySelector('[data-testid="cm-table-widget"]')).not.toBeNull();

    view.destroy();
    parent.remove();
  });

  it('exits table to a new line below on Enter key in last row', () => {
    const tableOnlyDoc = ['| A | B |', '| --- | --- |', '| Val 1 | Val 2 |'].join('\n');
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: tableOnlyDoc,
        extensions: [createTableVisualExtension(() => 'en')],
      }),
      parent,
    });

    const cell = parent.querySelector('tbody .cm-table-cell') as HTMLElement;
    expect(cell).not.toBeNull();

    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    // Document now has exactly 1 new line appended after table (no massive empty void)
    expect(view.state.doc.toString()).toBe(`${tableOnlyDoc}\n`);
    expect(view.state.selection.main.anchor).toBe(view.state.doc.length);

    view.destroy();
    parent.remove();
  });

  it('removes empty trailing line on Backspace and refocuses table cell', () => {
    const tableWithEmptyTrailingLine = ['| A | B |', '| --- | --- |', '| Val 1 | Val 2 |', ''].join('\n');
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: tableWithEmptyTrailingLine,
        selection: { anchor: tableWithEmptyTrailingLine.length },
        extensions: [createTableVisualExtension(() => 'en')],
      }),
      parent,
    });

    // Cursor is at empty line 4 right after table
    const line = view.state.doc.lineAt(view.state.selection.main.anchor);
    expect(line.number).toBe(4);
    expect(line.length).toBe(0);

    // Dispatch Backspace
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    // Empty line has been deleted
    expect(view.state.doc.lines).toBe(3);
    expect(view.state.doc.toString()).toBe(['| A | B |', '| --- | --- |', '| Val 1 | Val 2 |'].join('\n'));

    view.destroy();
    parent.remove();
  });

  it('selects cells with Shift+Click and clears them with Delete key', () => {
    const tableDoc = [
      '| H1 | H2 | H3 |',
      '| --- | --- | --- |',
      '| R0C0 | R0C1 | R0C2 |',
      '| R1C0 | R1C1 | R1C2 |',
    ].join('\n');
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: tableDoc,
        extensions: [createTableVisualExtension(() => 'en')],
      }),
      parent,
    });

    const getCell = (r: number, c: number) =>
      parent.querySelector<HTMLElement>(`[data-row="${r}"][data-col="${c}"]`);

    const cell00 = getCell(0, 0)!;
    const cell11 = getCell(1, 1)!;

    // Normal click at (0, 0)
    cell00.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));

    // Shift + click at (1, 1)
    cell11.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }));

    // Verify 4 cells are selected
    expect(getCell(0, 0)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(0, 1)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(1, 0)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(1, 1)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(0, 2)?.classList.contains('is-multi-selected')).toBe(false);
    expect(getCell(1, 2)?.classList.contains('is-multi-selected')).toBe(false);

    // Press Delete
    cell11.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

    // Document reflects cleared cells
    const docText = view.state.doc.toString();
    expect(docText).toContain('R0C2');
    expect(docText).toContain('R1C2');
    expect(docText).not.toContain('R0C0');
    expect(docText).not.toContain('R0C1');
    expect(docText).not.toContain('R1C0');
    expect(docText).not.toContain('R1C1');

    view.destroy();
    parent.remove();
  });

  it('toggles cells with Ctrl+Click and clears only selected cells with Backspace', () => {
    const tableDoc = [
      '| H1 | H2 | H3 |',
      '| --- | --- | --- |',
      '| R0C0 | R0C1 | R0C2 |',
      '| R1C0 | R1C1 | R1C2 |',
    ].join('\n');
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: tableDoc,
        extensions: [createTableVisualExtension(() => 'en')],
      }),
      parent,
    });

    const getCell = (r: number, c: number) =>
      parent.querySelector<HTMLElement>(`[data-row="${r}"][data-col="${c}"]`);

    const cell00 = getCell(0, 0)!;
    const cell01 = getCell(0, 1)!;
    const cell12 = getCell(1, 2)!;

    // Click (0,0)
    cell00.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));

    // Ctrl + Click (1,2)
    cell12.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, ctrlKey: true }));
    // Ctrl + Click (0,1)
    cell01.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, ctrlKey: true }));

    expect(getCell(0, 0)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(1, 2)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(0, 1)?.classList.contains('is-multi-selected')).toBe(true);

    // Ctrl + Click (0,1) again to unselect it
    cell01.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, ctrlKey: true }));
    expect(getCell(0, 1)?.classList.contains('is-multi-selected')).toBe(false);

    // Press Backspace
    cell12.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    const docText = view.state.doc.toString();
    // Cleared
    expect(docText).not.toContain('R0C0');
    expect(docText).not.toContain('R1C2');
    // Kept
    expect(docText).toContain('R0C1');
    expect(docText).toContain('R0C2');
    expect(docText).toContain('R1C0');
    expect(docText).toContain('R1C1');

    view.destroy();
    parent.remove();
  });

  it('selects cells by dragging mouse across cells and clears with Delete', () => {
    const tableDoc = [
      '| H1 | H2 | H3 |',
      '| --- | --- | --- |',
      '| A1 | B1 | C1 |',
      '| A2 | B2 | C2 |',
    ].join('\n');
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: tableDoc,
        extensions: [createTableVisualExtension(() => 'en')],
      }),
      parent,
    });

    const getCell = (r: number, c: number) =>
      parent.querySelector<HTMLElement>(`[data-row="${r}"][data-col="${c}"]`);

    const cell00 = getCell(0, 0)!;
    const cell11 = getCell(1, 1)!;

    // Drag start at (0, 0)
    cell00.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    // Drag enter at (1, 1)
    cell11.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    // Drag end
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(getCell(0, 0)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(0, 1)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(1, 0)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(1, 1)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(0, 2)?.classList.contains('is-multi-selected')).toBe(false);

    // Press Delete
    cell11.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

    const docText = view.state.doc.toString();
    expect(docText).toContain('C1');
    expect(docText).toContain('C2');
    expect(docText).not.toContain('A1');
    expect(docText).not.toContain('B1');
    expect(docText).not.toContain('A2');
    expect(docText).not.toContain('B2');

    view.destroy();
    parent.remove();
  });

  it('extends selection with Shift+Arrow keys and clears with Delete', () => {
    const tableDoc = [
      '| H1 | H2 |',
      '| --- | --- |',
      '| X1 | Y1 |',
      '| X2 | Y2 |',
    ].join('\n');
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: tableDoc,
        extensions: [createTableVisualExtension(() => 'en')],
      }),
      parent,
    });

    const getCell = (r: number, c: number) =>
      parent.querySelector<HTMLElement>(`[data-row="${r}"][data-col="${c}"]`);

    const cell00 = getCell(0, 0)!;
    cell00.focus();
    cell00.dispatchEvent(new Event('focus'));

    // Shift + ArrowRight -> selects (0,0) and (0,1)
    cell00.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
    expect(getCell(0, 0)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(0, 1)?.classList.contains('is-multi-selected')).toBe(true);

    // Shift + ArrowDown -> selects (0,0), (0,1), (1,0), (1,1)
    const cell01 = getCell(0, 1)!;
    cell01.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
    expect(getCell(1, 0)?.classList.contains('is-multi-selected')).toBe(true);
    expect(getCell(1, 1)?.classList.contains('is-multi-selected')).toBe(true);

    // Press Delete
    const cell11 = getCell(1, 1)!;
    cell11.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

    const docText = view.state.doc.toString();
    expect(docText).not.toContain('X1');
    expect(docText).not.toContain('Y1');
    expect(docText).not.toContain('X2');
    expect(docText).not.toContain('Y2');

    view.destroy();
    parent.remove();
  });

  it('forwards Ctrl+Z, Ctrl+Y, and Ctrl+Shift+Z inside table cells to CodeMirror undo and redo', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: sampleDoc,
        extensions: [history(), createTableVisualExtension(() => 'en')],
      }),
      parent,
    });

    const cell = parent.querySelector('tbody .cm-table-cell') as HTMLElement;
    cell.focus();
    cell.textContent = 'Edited Cell';
    cell.dispatchEvent(new Event('blur'));

    expect(view.state.doc.toString()).toContain('Edited Cell');

    // Press Ctrl+Z to undo
    const activeCell = parent.querySelector('tbody .cm-table-cell') as HTMLElement;
    activeCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(view.state.doc.toString()).not.toContain('Edited Cell');
    expect(view.state.doc.toString()).toContain('Cell 1');

    // Press Ctrl+Y to redo
    const cellAfterUndo = parent.querySelector('tbody .cm-table-cell') as HTMLElement;
    cellAfterUndo.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
    expect(view.state.doc.toString()).toContain('Edited Cell');

    // Press Ctrl+Z to undo, then Ctrl+Shift+Z to redo
    const cellAfterRedo = parent.querySelector('tbody .cm-table-cell') as HTMLElement;
    cellAfterRedo.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(view.state.doc.toString()).toContain('Cell 1');

    const cellForShiftZ = parent.querySelector('tbody .cm-table-cell') as HTMLElement;
    cellForShiftZ.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }));
    expect(view.state.doc.toString()).toContain('Edited Cell');

    view.destroy();
    parent.remove();
  });
});
