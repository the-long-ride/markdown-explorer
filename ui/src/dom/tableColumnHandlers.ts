import type { TableState } from './tableHandlers';
import { getTableUiLabels } from './tableUiLabels';
import { createSwitchButtonElement } from './switchButtonElement';

export function registerTableColumnHandlers(
  win: any,
  syncWrappedColumnWidths: (tableId: string, wrapped: boolean) => void,
) {
  const syncColumnVisibility = (tableId: string, state: TableState) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const hidden = new Set(state.hiddenColumnIdxs);
    table.querySelectorAll<HTMLElement>('thead th').forEach((cell, index) => cell.classList.toggle('is-hidden-column', hidden.has(index)));
    table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
      [...row.cells].forEach((cell, index) => cell.classList.toggle('is-hidden-column', hidden.has(index)));
    });
    document.getElementById(`${tableId}-columns-toggle`)?.classList.toggle('is-active', hidden.size > 0);
    if (state.wrapped) syncWrappedColumnWidths(tableId, true);
    if (typeof win.Table.refreshChartAvailability === 'function') win.Table.refreshChartAvailability(tableId);
  };

  const renderColumnMenu = (tableId: string) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    const menu = document.getElementById(`${tableId}-columns-menu`);
    if (!table || !menu) return;
    const state = win.Table.initState(tableId) as TableState;
    const hidden = new Set(state.hiddenColumnIdxs);
    const labels = getTableUiLabels(tableId);
    const headers = [...table.querySelectorAll<HTMLElement>('thead th')];
    menu.replaceChildren();

    const showAll = document.createElement('button');
    showAll.type = 'button';
    showAll.className = 'mdn-table-columns-menu__show-all';
    showAll.textContent = labels.showAllColumns;
    showAll.disabled = hidden.size === 0;
    showAll.addEventListener('click', () => win.Table.showAllColumns(tableId));
    menu.appendChild(showAll);

    headers.forEach((header, colIndex) => {
      const item = document.createElement('div');
      item.className = 'mdn-table-columns-menu__item';
      const text = document.createElement('span');
      text.className = 'mdn-table-columns-menu__label';
      const columnLabel = header.querySelector('.mdn-th-text')?.textContent?.trim() || `${labels.columns} ${colIndex + 1}`;
      text.textContent = columnLabel;
      const checked = !hidden.has(colIndex);
      const visibleColumnCount = headers.length - hidden.size;
      const toggle = createSwitchButtonElement({
        checked,
        label: columnLabel,
        disabled: checked && visibleColumnCount <= 1,
        className: 'mdn-table-columns-menu__toggle',
        onChange: (nextChecked) => win.Table.setColumnVisibility(tableId, colIndex, nextChecked),
      });
      item.append(text, toggle);
      menu.appendChild(item);
    });
  };

  win.Table.closeColumnMenu = (tableId: string) => {
    const root = document.getElementById(`${tableId}-columns`);
    const menu = document.getElementById(`${tableId}-columns-menu`);
    const button = document.getElementById(`${tableId}-columns-toggle`);
    root?.classList.remove('is-open');
    menu?.setAttribute('hidden', '');
    button?.setAttribute('aria-expanded', 'false');
  };

  win.Table.toggleColumnMenu = (tableId: string, event: Event) => {
    event.stopPropagation();
    const root = document.getElementById(`${tableId}-columns`);
    const menu = document.getElementById(`${tableId}-columns-menu`);
    const button = document.getElementById(`${tableId}-columns-toggle`);
    if (!root || !menu || !button) return;
    const opening = !root.classList.contains('is-open');
    document.querySelectorAll<HTMLElement>('.mdn-table-columns.is-open').forEach((other) => {
      win.Table.closeColumnMenu(other.id.replace(/-columns$/, ''));
    });
    if (!opening) return;
    renderColumnMenu(tableId);
    root.classList.add('is-open');
    menu.removeAttribute('hidden');
    button.setAttribute('aria-expanded', 'true');
    const outside = (pointerEvent: PointerEvent) => {
      if (!root.contains(pointerEvent.target as Node)) {
        win.Table.closeColumnMenu(tableId);
        document.removeEventListener('pointerdown', outside);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', outside), 0);
  };

  win.Table.setColumnVisibility = (tableId: string, colIndex: number, visible: boolean) => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return false;
    const state = win.Table.initState(tableId) as TableState;
    const hidden = new Set<number>(state.hiddenColumnIdxs);
    const visibleColumnCount = table.querySelectorAll('thead th').length - hidden.size;
    if (!visible && !hidden.has(colIndex) && visibleColumnCount <= 1) return false;
    if (visible) hidden.delete(colIndex); else hidden.add(colIndex);
    state.hiddenColumnIdxs = [...hidden].sort((a, b) => a - b);
    syncColumnVisibility(tableId, state);
    renderColumnMenu(tableId);
    return true;
  };

  win.Table.showAllColumns = (tableId: string) => {
    const state = win.Table.initState(tableId) as TableState;
    state.hiddenColumnIdxs = [];
    syncColumnVisibility(tableId, state);
    renderColumnMenu(tableId);
  };
}
