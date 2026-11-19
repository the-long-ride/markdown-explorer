import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableInsertDialog } from '../../../../ui/src/components/Content/TableInsertDialog';

describe('TableInsertDialog', () => {
  it('does not render when open is false', () => {
    render(<TableInsertDialog open={false} language="en" onInsert={() => {}} onClose={() => {}} />);
    expect(screen.queryByTestId('table-insert-dialog')).toBeNull();
  });

  it('renders default values and submits custom rows and cols', () => {
    const handleInsert = vi.fn();
    const handleClose = vi.fn();

    render(
      <TableInsertDialog
        open={true}
        language="en"
        onInsert={handleInsert}
        onClose={handleClose}
      />,
    );

    const colsInput = screen.getByTestId('table-insert-cols') as HTMLInputElement;
    const rowsInput = screen.getByTestId('table-insert-rows') as HTMLInputElement;

    expect(colsInput.value).toBe('3');
    expect(rowsInput.value).toBe('3');

    fireEvent.change(colsInput, { target: { value: '4' } });
    fireEvent.change(rowsInput, { target: { value: '5' } });

    fireEvent.click(screen.getByTestId('table-insert-confirm'));

    expect(handleInsert).toHaveBeenCalledWith(5, 4);
    expect(handleClose).toHaveBeenCalled();
  });

  it('closes on Escape key press or backdrop click', () => {
    const handleClose = vi.fn();

    render(
      <TableInsertDialog
        open={true}
        language="en"
        onInsert={() => {}}
        onClose={handleClose}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);

    const backdrop = screen.getByTestId('table-insert-dialog-backdrop');
    fireEvent.mouseDown(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('triggers primary insert action on Enter key press', () => {
    const handleInsert = vi.fn();
    const handleClose = vi.fn();

    render(
      <TableInsertDialog
        open={true}
        language="en"
        onInsert={handleInsert}
        onClose={handleClose}
      />,
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(handleInsert).toHaveBeenCalledWith(3, 3);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders 7x7 grid and updates dimensions on cell hover/click', () => {
    const handleInsert = vi.fn();
    const handleClose = vi.fn();

    render(
      <TableInsertDialog
        open={true}
        language="en"
        onInsert={handleInsert}
        onClose={handleClose}
      />,
    );

    const grid = screen.getByTestId('table-insert-grid');
    expect(grid).not.toBeNull();

    const status = screen.getByTestId('table-insert-grid-status');
    expect(status.textContent).toBe('Row 3 × 3 Columns');

    // Check 49 cells exist
    const cells = grid.querySelectorAll('.table-insert-dialog__grid-cell');
    expect(cells.length).toBe(49);

    // Initial 3x3 highlighted
    const highlightedInitial = grid.querySelectorAll('.is-highlighted');
    expect(highlightedInitial.length).toBe(9);

    // Pointer enter cell (row 2, col 5)
    const targetCell = screen.getByTestId('table-grid-cell-2-5');
    fireEvent.pointerEnter(targetCell);

    expect(status.textContent).toBe('Row 2 × 5 Columns');
    const colsInput = screen.getByTestId('table-insert-cols') as HTMLInputElement;
    const rowsInput = screen.getByTestId('table-insert-rows') as HTMLInputElement;
    expect(colsInput.value).toBe('5');
    expect(rowsInput.value).toBe('2');

    // 2 rows * 5 cols = 10 highlighted cells
    expect(grid.querySelectorAll('.is-highlighted').length).toBe(10);

    // Click cell (row 4, col 6) to lock selection
    const cell46 = screen.getByTestId('table-grid-cell-4-6');
    fireEvent.click(cell46);
    expect(colsInput.value).toBe('6');
    expect(rowsInput.value).toBe('4');
    expect(cell46.classList.contains('is-corner')).toBe(true);
    expect(grid.classList.contains('is-locked')).toBe(true);
    expect(screen.getByTestId('table-insert-grid-locked-badge')).not.toBeNull();

    // Moving mouse across cell 1-1 after clicking MUST NOT change the locked selection
    const cell11 = screen.getByTestId('table-grid-cell-1-1');
    fireEvent.pointerEnter(cell11);
    expect(colsInput.value).toBe('6');
    expect(rowsInput.value).toBe('4');

    fireEvent.click(screen.getByTestId('table-insert-confirm'));
    expect(handleInsert).toHaveBeenCalledWith(4, 6);
    expect(handleClose).toHaveBeenCalled();
  });

  it('supports double click on grid cell for instant insertion', () => {
    const handleInsert = vi.fn();
    const handleClose = vi.fn();

    render(
      <TableInsertDialog
        open={true}
        language="en"
        onInsert={handleInsert}
        onClose={handleClose}
      />,
    );

    const cell23 = screen.getByTestId('table-grid-cell-2-3');
    fireEvent.doubleClick(cell23);

    expect(handleInsert).toHaveBeenCalledWith(2, 3);
    expect(handleClose).toHaveBeenCalled();
  });

  it('preserves typed values and ignores passive grid hover when manual input entered', () => {
    const handleInsert = vi.fn();
    const handleClose = vi.fn();

    render(
      <TableInsertDialog
        open={true}
        language="en"
        onInsert={handleInsert}
        onClose={handleClose}
      />,
    );

    const colsInput = screen.getByTestId('table-insert-cols') as HTMLInputElement;
    fireEvent.change(colsInput, { target: { value: '12' } });

    // Moving mouse across cell 1-1 should not overwrite typed 12
    const cell11 = screen.getByTestId('table-grid-cell-1-1');
    fireEvent.pointerEnter(cell11);

    expect(colsInput.value).toBe('12');

    // But clicking cell 4-5 intentionally resets manual mode to grid selection
    const cell45 = screen.getByTestId('table-grid-cell-4-5');
    fireEvent.click(cell45);
    expect(colsInput.value).toBe('5');

    fireEvent.click(screen.getByTestId('table-insert-confirm'));
    expect(handleInsert).toHaveBeenCalledWith(4, 5);
  });
});
