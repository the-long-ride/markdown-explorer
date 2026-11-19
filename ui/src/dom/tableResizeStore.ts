import {
  TABLE_MAX_WRAPPED_COLUMN_CHARS,
  TABLE_MIN_WRAPPED_COLUMN_CHARS,
} from '../constants/limits';

export interface StoredTableLayout {
  wrapped?: boolean;
  columnWidths?: number[];
}

const tableLayoutsByFile = new Map<string, StoredTableLayout>();

export function getTableKey(table: HTMLElement): string {
  const container = table.closest('[data-file-path]') || table.closest('.mdn-body') || document.body;
  const filePath = container.getAttribute('data-file-path')
    || container.getAttribute('data-mdn-source-document-path')
    || '';
  const allTables = Array.from(container.querySelectorAll('table.mdn-table'));
  const tableIndex = Math.max(0, allTables.indexOf(table as HTMLTableElement));
  const headers = Array.from(table.querySelectorAll('thead th'))
    .map((th) => th.textContent?.trim().replace(/\s+/g, ' ') || '')
    .join('|');
  return `${filePath}::table-${tableIndex}::${headers}`;
}

export function getStoredTableLayout(key: string): StoredTableLayout | undefined {
  return tableLayoutsByFile.get(key);
}

export function setStoredTableLayout(key: string, patch: Partial<StoredTableLayout>): void {
  const existing = tableLayoutsByFile.get(key) || {};
  tableLayoutsByFile.set(key, { ...existing, ...patch });
}

export function clearStoredColumnWidths(key: string): void {
  const existing = tableLayoutsByFile.get(key);
  if (!existing) return;
  const { columnWidths: _removed, ...rest } = existing;
  if (Object.keys(rest).length === 0) tableLayoutsByFile.delete(key);
  else tableLayoutsByFile.set(key, rest);
}

export function clearTableLayoutStore(): void {
  tableLayoutsByFile.clear();
}

function applyColumnWidthValue(col: Element, px: number): void {
  const htmlCol = col as HTMLElement;
  htmlCol.style.setProperty('--mdn-column-width', `${px}px`);
  htmlCol.style.width = `${px}px`;
}

function syncResetButtonVisibility(table: HTMLTableElement, visible: boolean): void {
  if (!table.id) return;
  const resetBtn = document.getElementById(`${table.id}-reset-widths`) as HTMLButtonElement | null;
  if (resetBtn) resetBtn.hidden = !visible;
}

const MIN_COL_WIDTH = 40;

function ensureCustomColumnColgroup(table: HTMLTableElement, count: number): HTMLTableColElement {
  const existing = table.querySelector<HTMLTableColElement>('colgroup[data-mdn-wrapped-columns]');
  if (existing && existing.querySelectorAll('col').length === count) return existing;
  existing?.remove();
  const colgroup = document.createElement('colgroup');
  colgroup.dataset.mdnWrappedColumns = 'true';
  for (let i = 0; i < count; i += 1) colgroup.appendChild(document.createElement('col'));
  table.prepend(colgroup);
  return colgroup;
}

function measureHeaderWidths(headers: readonly HTMLElement[]): number[] {
  return headers.map((h) => (
    h.classList.contains('is-hidden-column') ? 0 : Math.max(MIN_COL_WIDTH, Math.round(h.getBoundingClientRect().width))
  ));
}

function applyColumnWidths(table: HTMLTableElement, colgroup: HTMLTableColElement, widths: number[]): void {
  const total = widths.reduce((sum, w) => sum + w, 0);
  const cols = Array.from(colgroup.querySelectorAll('col'));
  cols.forEach((col, i) => applyColumnWidthValue(col, widths[i] ?? 0));
  table.style.setProperty('--mdn-wrapped-table-min-width', `${total}px`);
}

export function attachTableColumnResizers(table: HTMLTableElement): void {
  const headers = Array.from(table.querySelectorAll<HTMLElement>('thead th.mdn-th'));
  if (headers.length <= 1) return;

  if (!table.dataset.hasHeaderActionKeys) {
    table.dataset.hasHeaderActionKeys = 'true';
    table.querySelector('thead')?.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.key !== 'Enter' && event.key !== ' ')) return;
      const btn = (event.target as Element | null)?.closest<HTMLElement>('.mdn-th-actions [role="button"]');
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      btn.click();
    });
  }

  headers.forEach((th, colIdx) => {
    let resizer = th.querySelector<HTMLElement>('.mdn-table-col-resizer');
    if (!resizer) {
      resizer = document.createElement('div');
      resizer.className = 'mdn-table-col-resizer';
      resizer.setAttribute('role', 'separator');
      resizer.setAttribute('aria-orientation', 'vertical');
      resizer.setAttribute('tabindex', '0');
      th.appendChild(resizer);
    }

    if (resizer.dataset.hasColResizer) return;
    resizer.dataset.hasColResizer = 'true';

    resizer.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      event.stopPropagation();
      const delta = (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 40 : 16);
      const tableWrap = table.closest('.mdn-table-wrap');
      const wrapped = Boolean(tableWrap?.classList.contains('is-wrapped'));
      const colgroup = ensureCustomColumnColgroup(table, headers.length);
      const key = getTableKey(table);
      const storedWidths = tableWrap?.classList.contains('has-custom-column-widths')
        ? getStoredTableLayout(key)?.columnWidths
        : undefined;
      const measuredWidths = measureHeaderWidths(headers);
      const nextWidths = measuredWidths.map((w, i) => (w === 0 ? 0 : (storedWidths?.[i] || w)));
      nextWidths[colIdx] = Math.max(MIN_COL_WIDTH, nextWidths[colIdx] + delta);
      applyColumnWidths(table, colgroup, nextWidths);
      tableWrap?.classList.add('has-custom-column-widths');
      setStoredTableLayout(key, { columnWidths: nextWidths, wrapped });
      syncResetButtonVisibility(table, true);
    });

    resizer.addEventListener('pointerdown', (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const tableWrap = table.closest('.mdn-table-wrap');
      const wrapped = Boolean(tableWrap?.classList.contains('is-wrapped'));
      const colgroup = ensureCustomColumnColgroup(table, headers.length);

      resizer?.classList.add('is-resizing');
      document.body.classList.add('is-table-col-resizing');

      const startX = event.clientX;
      const initialWidths = measureHeaderWidths(headers);
      let hasMoved = false;

      const computeWidths = (clientX: number) => {
        const delta = clientX - startX;
        return initialWidths.map((w, i) => (
          i === colIdx ? Math.max(MIN_COL_WIDTH, Math.round(initialWidths[colIdx] + delta)) : w
        ));
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!hasMoved && moveEvent.clientX === startX) return;
        hasMoved = true;
        tableWrap?.classList.add('has-custom-column-widths');
        syncResetButtonVisibility(table, true);
        applyColumnWidths(table, colgroup, computeWidths(moveEvent.clientX));
      };

      const finishDrag = (clientX: number, cancelled: boolean) => {
        resizer?.classList.remove('is-resizing');
        document.body.classList.remove('is-table-col-resizing');
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        window.removeEventListener('blur', onWindowBlur);

        if (cancelled) return;
        const delta = clientX - startX;
        const key = getTableKey(table);
        const existingStored = getStoredTableLayout(key);
        if (!hasMoved && delta === 0 && !existingStored?.columnWidths) {
          if (!wrapped) {
            colgroup.remove();
            table.style.removeProperty('--mdn-wrapped-table-min-width');
          }
          return;
        }

        const finalWidths = computeWidths(clientX);
        applyColumnWidths(table, colgroup, finalWidths);
        tableWrap?.classList.add('has-custom-column-widths');
        setStoredTableLayout(key, { columnWidths: finalWidths, wrapped });
        syncResetButtonVisibility(table, true);
      };

      const onPointerUp = (upEvent: PointerEvent) => finishDrag(upEvent.clientX, false);
      const onPointerCancel = (cancelEvent: PointerEvent) => finishDrag(cancelEvent.clientX, true);
      const onWindowBlur = () => finishDrag(startX, true);

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
      window.addEventListener('blur', onWindowBlur);
    });
  });
}

export function syncWrappedTableColumns(
  tableId: string,
  wrapped: boolean,
  getWeights: (table: HTMLTableElement) => number[],
): void {
  const table = document.getElementById(tableId) as HTMLTableElement | null;
  if (!table) return;
  const tableWrap = table.closest('.mdn-table-wrap');
  table.querySelector('colgroup[data-mdn-wrapped-columns]')?.remove();
  table.style.removeProperty('--mdn-wrapped-table-min-width');

  const key = getTableKey(table);
  const stored = getStoredTableLayout(key);
  const headers = table.querySelectorAll('thead th');
  const hasCustomWidths = Boolean(stored?.columnWidths && stored.columnWidths.length === headers.length);

  if (hasCustomWidths && stored?.columnWidths) {
    const colgroup = document.createElement('colgroup');
    colgroup.dataset.mdnWrappedColumns = 'true';
    let totalWidth = 0;
    stored.columnWidths.forEach((width, index) => {
      const effectiveWidth = headers[index]?.classList.contains('is-hidden-column') ? 0 : width;
      totalWidth += effectiveWidth;
      const col = document.createElement('col');
      applyColumnWidthValue(col, effectiveWidth);
      colgroup.appendChild(col);
    });
    table.style.setProperty('--mdn-wrapped-table-min-width', `${totalWidth}px`);
    table.prepend(colgroup);
    tableWrap?.classList.add('has-custom-column-widths');
    attachTableColumnResizers(table);
    return;
  }

  tableWrap?.classList.remove('has-custom-column-widths');
  if (!wrapped) {
    attachTableColumnResizers(table);
    return;
  }

  const weights = getWeights(table);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  if (!weights.length || !totalWeight) return;
  const colgroup = document.createElement('colgroup');
  colgroup.dataset.mdnWrappedColumns = 'true';
  const visibleMinWidth = weights.reduce((sum, weight) => sum + (weight === 0 ? 0 : weight <= 8 ? 48 : 75), 0);
  table.style.setProperty('--mdn-wrapped-table-min-width', `${Math.round(Math.max(visibleMinWidth, totalWeight * 5.5))}px`);
  weights.forEach((weight) => {
    const col = document.createElement('col');
    col.style.setProperty('--mdn-column-width', `${((weight / totalWeight) * 100).toFixed(3)}%`);
    colgroup.appendChild(col);
  });
  table.prepend(colgroup);
  attachTableColumnResizers(table);
}

export function getWrappedColumnWeights(table: HTMLTableElement): number[] {
  const headers = [...table.querySelectorAll<HTMLElement>('.mdn-th')];
  const columnCount = headers.length || table.rows?.[0]?.cells?.length || 0;
  if (!columnCount) return [];

  const rows = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
  const dataRows = rows.filter((row) => !row.dataset.toggle && row.id !== `${table.id}-toggle-row`);
  return Array.from({ length: columnCount }, (_, columnIndex) => {
    if (headers[columnIndex]?.classList.contains('is-hidden-column')) return 0;
    const values = dataRows.map((row) => row.cells[columnIndex]?.textContent?.trim() ?? '').filter(Boolean);
    const lengths = values.map((value) => value.length).sort((a, b) => a - b);
    const trimCount = Math.floor(lengths.length * 0.1);
    const trimmedLengths = lengths.slice(trimCount, lengths.length - trimCount) || lengths;
    const averageLength = trimmedLengths.reduce((total, length) => total + length, 0) / (trimmedLengths.length || 1);
    const headerText = headers[columnIndex]?.querySelector('.mdn-th-text')?.textContent?.trim() ?? headers[columnIndex]?.textContent?.trim() ?? '';
    const headerLength = headerText.length;
    const maxCellLength = lengths[lengths.length - 1] ?? 0;
    const longestWord = Math.min(14, Math.max(0, ...[headerText, ...values].flatMap((t) => t.split(/\s+/)).map((w) => w.length)));
    const isIndexColumn = /^(index|#|no\.?|number|id|stt|dev\s*#)$/i.test(headerText);
    const isDateColumn = values.length > 0 && values.every((value) => /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(value));
    const isNumericColumn = values.length > 0 && values.every((value) => /^[-+]?[$€£]?\d[\d,]*(?:\.\d+)?%?$/.test(value));
    const isShortColumn = values.length > 0 && maxCellLength <= 6 && headerLength <= 10;
    const minimumLength = isIndexColumn ? 5 : isDateColumn ? 11 : isNumericColumn ? 8 : isShortColumn ? 6 : TABLE_MIN_WRAPPED_COLUMN_CHARS;
    return Math.min(TABLE_MAX_WRAPPED_COLUMN_CHARS, Math.max(minimumLength, averageLength, headerLength, longestWord + 4));
  });
}

export function getWrappedColumnPercentages(table: HTMLTableElement): number[] {
  const weights = getWrappedColumnWeights(table);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0) || 1;
  return weights.map((weight) => (weight / totalWeight) * 100);
}
