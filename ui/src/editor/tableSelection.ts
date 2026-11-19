import type { EditorView } from '@codemirror/view';
import { clearCells, type TableData } from './tableEditor';

export interface CellCoord {
  row: number;
  col: number;
}

export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function parseCellKey(key: string): CellCoord {
  const parts = key.split(':');
  return { row: parseInt(parts[0], 10), col: parseInt(parts[1], 10) };
}

export function getRectangularRange(c1: CellCoord, c2: CellCoord): CellCoord[] {
  const minRow = Math.min(c1.row, c2.row);
  const maxRow = Math.max(c1.row, c2.row);
  const minCol = Math.min(c1.col, c2.col);
  const maxCol = Math.max(c1.col, c2.col);

  const result: CellCoord[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      result.push({ row: r, col: c });
    }
  }
  return result;
}

interface PersistedSelection {
  tableFrom: number;
  selectedKeys: Set<string>;
  anchor: CellCoord | null;
  lead: CellCoord | null;
}

const activeSelections = new WeakMap<EditorView, PersistedSelection>();

export interface TableSelectionOptions {
  view: EditorView;
  tableFrom: number;
  container: HTMLElement;
  table: HTMLTableElement;
  getData: () => TableData;
  updateDocWith: (data: TableData) => void;
}

export class TableSelectionController {
  private view: EditorView;
  private tableFrom: number;
  private container: HTMLElement;
  private table: HTMLTableElement;
  private getData: () => TableData;
  private updateDocWith: (data: TableData) => void;

  private selectedKeys = new Set<string>();
  private anchor: CellCoord | null = null;
  private lead: CellCoord | null = null;
  private isDragging = false;
  private hasDraggedAcrossCells = false;
  private dragStart: CellCoord | null = null;
  private isMultiSelectionActive = false;
  private isClearingState = false;
  private onDocMouseDown: (e: MouseEvent) => void;

  constructor(options: TableSelectionOptions) {
    this.view = options.view;
    this.tableFrom = options.tableFrom;
    this.container = options.container;
    this.table = options.table;
    this.getData = options.getData;
    this.updateDocWith = options.updateDocWith;

    this.onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !this.container.contains(target)) {
        this.clearSelection();
      }
    };
    document.addEventListener('mousedown', this.onDocMouseDown);
  }

  public bindCell(cell: HTMLElement, row: number, col: number): void {
    cell.addEventListener('mousedown', (e) => this.handleCellMouseDown(e, row, col, cell));
    cell.addEventListener('mouseenter', () => this.handleCellMouseEnter(row, col));
    cell.addEventListener('focus', () => this.handleCellFocus(row, col));
  }

  private handleCellMouseDown(e: MouseEvent, row: number, col: number, cell: HTMLElement): void {
    if (e.button !== 0) return;

    if (e.shiftKey) {
      e.preventDefault();
      const anchor = this.anchor ?? { row, col };
      this.anchor = anchor;
      this.lead = { row, col };
      const range = getRectangularRange(anchor, this.lead);
      this.selectedKeys = new Set(range.map((c) => cellKey(c.row, c.col)));
      this.isMultiSelectionActive = true;
      this.applySelectionStyles();
      this.persist();
      window.getSelection()?.removeAllRanges();
      cell.focus({ preventScroll: true });
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const key = cellKey(row, col);
      if (this.selectedKeys.size === 0 && this.anchor) {
        this.selectedKeys.add(cellKey(this.anchor.row, this.anchor.col));
      }
      if (this.selectedKeys.has(key)) {
        this.selectedKeys.delete(key);
      } else {
        this.selectedKeys.add(key);
      }
      this.isMultiSelectionActive = this.selectedKeys.size > 0;
      this.anchor = { row, col };
      this.lead = { row, col };
      this.applySelectionStyles();
      this.persist();
      window.getSelection()?.removeAllRanges();
      cell.focus({ preventScroll: true });
      return;
    }

    if (this.isMultiSelectionActive || this.selectedKeys.size > 0) {
      this.clearSelection();
    }
    this.anchor = { row, col };
    this.lead = { row, col };
    this.dragStart = { row, col };
    this.isDragging = true;
    this.hasDraggedAcrossCells = false;
    this.isMultiSelectionActive = false;

    const onWindowMouseUp = () => {
      window.removeEventListener('mouseup', onWindowMouseUp);
      this.isDragging = false;
      if (this.hasDraggedAcrossCells) {
        this.isMultiSelectionActive = true;
        window.getSelection()?.removeAllRanges();
        const leadEl = this.getCellElement(this.lead?.row ?? row, this.lead?.col ?? col);
        leadEl?.focus({ preventScroll: true });
        window.getSelection()?.removeAllRanges();
        this.persist();
      }
      this.dragStart = null;
    };
    window.addEventListener('mouseup', onWindowMouseUp);
  }

  private handleCellMouseEnter(row: number, col: number): void {
    if (!this.isDragging || !this.dragStart) return;

    if (row !== this.dragStart.row || col !== this.dragStart.col) {
      this.hasDraggedAcrossCells = true;
      this.isMultiSelectionActive = true;
      window.getSelection()?.removeAllRanges();
      this.lead = { row, col };
      const range = getRectangularRange(this.dragStart, this.lead);
      this.selectedKeys = new Set(range.map((c) => cellKey(c.row, c.col)));
      this.applySelectionStyles();
    } else if (this.hasDraggedAcrossCells) {
      this.lead = { row, col };
      this.selectedKeys = new Set([cellKey(row, col)]);
      this.applySelectionStyles();
    }
  }

  private handleCellFocus(row: number, col: number): void {
    if (!this.isMultiSelectionActive) {
      this.anchor = { row, col };
      this.lead = { row, col };
    }
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (this.selectedKeys.size >= 2 || (this.selectedKeys.size > 0 && this.isMultiSelectionActive)) {
        e.preventDefault();
        e.stopPropagation();
        this.clearSelectedCells();
        return true;
      }
    }

    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const target = e.target as HTMLElement;
      let curRow = this.lead?.row;
      let curCol = this.lead?.col;
      if (curRow === undefined || curCol === undefined) {
        if (target?.classList.contains('cm-table-cell')) {
          curRow = parseInt(target.getAttribute('data-row') ?? '0', 10);
          curCol = parseInt(target.getAttribute('data-col') ?? '0', 10);
        } else {
          curRow = 0;
          curCol = 0;
        }
      }
      if (!this.anchor) {
        this.anchor = { row: curRow, col: curCol };
      }

      const data = this.getData();
      const minRow = -1;
      const maxRow = data.rows.length - 1;
      const minCol = 0;
      const maxCol = data.headers.length - 1;

      let nextRow = curRow;
      let nextCol = curCol;

      if (e.key === 'ArrowUp') nextRow = Math.max(minRow, curRow - 1);
      else if (e.key === 'ArrowDown') nextRow = Math.min(maxRow, curRow + 1);
      else if (e.key === 'ArrowLeft') nextCol = Math.max(minCol, curCol - 1);
      else if (e.key === 'ArrowRight') nextCol = Math.min(maxCol, curCol + 1);

      this.lead = { row: nextRow, col: nextCol };
      const range = getRectangularRange(this.anchor, this.lead);
      this.selectedKeys = new Set(range.map((c) => cellKey(c.row, c.col)));
      this.isMultiSelectionActive = true;
      this.applySelectionStyles();
      this.persist();

      e.preventDefault();
      e.stopPropagation();

      window.getSelection()?.removeAllRanges();
      const nextCell = this.getCellElement(nextRow, nextCol);
      nextCell?.focus({ preventScroll: true });
      window.getSelection()?.removeAllRanges();

      return true;
    }

    if (!e.shiftKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      if (this.selectedKeys.size > 1) {
        this.clearSelection();
        return false;
      }
    }

    if (e.key === 'Escape' && (this.selectedKeys.size > 0 || this.isMultiSelectionActive)) {
      this.clearSelection();
      e.preventDefault();
      e.stopPropagation();
      return true;
    }

    if ((e.key === 'Tab' || e.key === 'Enter') && this.selectedKeys.size > 1) {
      this.clearSelection();
      return false;
    }

    return false;
  }

  public clearSelectedCells(): void {
    if (this.selectedKeys.size === 0) return;
    this.isClearingState = true;
    try {
      const coords = Array.from(this.selectedKeys).map(parseCellKey);
      for (const coord of coords) {
        const el = this.getCellElement(coord.row, coord.col);
        if (el) el.textContent = '';
      }
      const currentData = this.getData();
      const nextData = clearCells(currentData, coords);
      this.persist();
      this.updateDocWith(nextData);
    } finally {
      this.isClearingState = false;
    }
  }

  public clearSelection(): void {
    this.selectedKeys.clear();
    this.isMultiSelectionActive = false;
    this.applySelectionStyles();
    activeSelections.delete(this.view);
  }

  public hasMultiSelection(): boolean {
    return this.selectedKeys.size >= 2 || (this.selectedKeys.size > 0 && this.isMultiSelectionActive);
  }

  public isClearing(): boolean {
    return this.isClearingState;
  }

  public getSelectedCellCoords(): CellCoord[] {
    return Array.from(this.selectedKeys).map(parseCellKey);
  }

  public applySelectionStyles(): void {
    const allCells = this.table.querySelectorAll<HTMLElement>('.cm-table-cell');
    allCells.forEach((cell) => {
      const r = parseInt(cell.getAttribute('data-row') ?? '0', 10);
      const c = parseInt(cell.getAttribute('data-col') ?? '0', 10);
      const isSelected = this.selectedKeys.has(cellKey(r, c));
      if (isSelected) {
        cell.classList.add('is-multi-selected');
        cell.setAttribute('data-cell-selected', 'true');
      } else {
        cell.classList.remove('is-multi-selected');
        cell.removeAttribute('data-cell-selected');
      }
    });
  }

  public restoreStyles(): void {
    const existing = activeSelections.get(this.view);
    if (existing && existing.tableFrom === this.tableFrom) {
      this.selectedKeys = new Set(existing.selectedKeys);
      this.anchor = existing.anchor;
      this.lead = existing.lead;
      this.isMultiSelectionActive = true;
      this.applySelectionStyles();
      const target = this.getCellElement(
        this.lead?.row ?? this.anchor?.row ?? 0,
        this.lead?.col ?? this.anchor?.col ?? 0,
      );
      if (target) {
        target.focus({ preventScroll: true });
        window.getSelection()?.removeAllRanges();
      }
    }
  }

  private persist(): void {
    if (this.selectedKeys.size > 0) {
      activeSelections.set(this.view, {
        tableFrom: this.tableFrom,
        selectedKeys: new Set(this.selectedKeys),
        anchor: this.anchor,
        lead: this.lead,
      });
    } else {
      activeSelections.delete(this.view);
    }
  }

  private getCellElement(row: number, col: number): HTMLElement | null {
    return this.table.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`);
  }

  public destroy(): void {
    document.removeEventListener('mousedown', this.onDocMouseDown);
  }
}
