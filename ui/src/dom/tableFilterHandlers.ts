import { getTableUiLabels } from './tableUiLabels';
import { normalizeFilterValues, setColumnFilterValues, type TableState } from './tableHandlers';

export function showFilterMenu(
  win: any,
  tableId: string,
  colIndex: number,
  buttonEl: HTMLElement,
  getTableDataRows: (table: HTMLTableElement) => HTMLTableRowElement[],
): void {
  document.querySelectorAll('.mdn-filter-dropdown, .mdn-align-dropdown').forEach((el) => el.remove());

  const table = document.getElementById(tableId) as HTMLTableElement | null;
  if (!table) return;
  const state: TableState = win.Table.initState(tableId);

  const rows = getTableDataRows(table);
  const values = rows
    .map((row) => (row.cells[colIndex]?.textContent ?? '').trim())
    .filter(Boolean);
  const uniqueValues = Array.from(new Set(values)).sort();

  const dropdown = document.createElement('div');
  dropdown.className = 'mdn-filter-dropdown';

  const header = document.createElement('div');
  header.className = 'mdn-filter-dropdown-header';
  const labels = getTableUiLabels(tableId);
  header.textContent = labels.filterValues;
  dropdown.appendChild(header);

  const allItem = document.createElement('div');
  allItem.className = `mdn-filter-item${normalizeFilterValues(state.filters[colIndex]).length === 0 ? ' is-active' : ''}`;
  allItem.textContent = labels.all;
  allItem.onclick = () => {
    setColumnFilterValues(state, colIndex, []);
    syncMenu();
    win.Table.applyAllFilters(tableId);
  };
  dropdown.appendChild(allItem);

  const valueItems: Array<{ item: HTMLDivElement; check: HTMLSpanElement; value: string }> = [];
  const syncMenu = () => {
    const activeValues = new Set(normalizeFilterValues(state.filters[colIndex]));
    allItem.classList.toggle('is-active', activeValues.size === 0);
    buttonEl.classList.toggle('is-active', activeValues.size > 0);
    valueItems.forEach(({ item, check, value }) => {
      const active = activeValues.has(value);
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-checked', String(active));
      check.textContent = active ? '✓' : '';
    });
  };

  uniqueValues.forEach((val) => {
    const item = document.createElement('div');
    item.className = 'mdn-filter-item';
    item.setAttribute('role', 'menuitemcheckbox');
    const check = document.createElement('span');
    check.className = 'mdn-filter-check';
    check.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'mdn-filter-label';
    label.textContent = val;
    item.appendChild(check);
    item.appendChild(label);
    item.onclick = () => {
      const next = normalizeFilterValues(state.filters[colIndex]);
      const existingIndex = next.indexOf(val);
      if (existingIndex >= 0) {
        next.splice(existingIndex, 1);
      } else {
        next.push(val);
      }
      setColumnFilterValues(state, colIndex, next);
      syncMenu();
      win.Table.applyAllFilters(tableId);
    };
    valueItems.push({ item, check, value: val });
    dropdown.appendChild(item);
  });

  if (uniqueValues.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'mdn-filter-empty';
    empty.textContent = labels.noValues;
    dropdown.appendChild(empty);
  }

  document.body.appendChild(dropdown);
  syncMenu();

  const updatePosition = () => {
    if (!buttonEl.isConnected) {
      dropdown.remove();
      cleanup();
      return;
    }
    const rect = buttonEl.getBoundingClientRect();
    const scrollContainer = buttonEl.closest<HTMLElement>(
      '.content__scroll, .split-document-pane__scroll, .mdn-table-scroll',
    );
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      if (
        rect.bottom < containerRect.top ||
        rect.top > containerRect.bottom ||
        rect.right < containerRect.left ||
        rect.left > containerRect.right
      ) {
        dropdown.remove();
        cleanup();
        return;
      }
    }
    dropdown.style.top = `${rect.bottom + 4}px`;
    const dropdownWidth = dropdown.offsetWidth || 160;
    const viewportWidth = window.innerWidth;
    let leftPos = rect.left;
    if (rect.left + dropdownWidth > viewportWidth) {
      leftPos = rect.right - dropdownWidth;
    }
    leftPos = Math.max(12, Math.min(leftPos, viewportWidth - dropdownWidth - 12));
    dropdown.style.left = `${leftPos}px`;
  };

  updatePosition();

  const outsideClickListener = (e: MouseEvent) => {
    if (!dropdown.contains(e.target as Node) && e.target !== buttonEl) {
      dropdown.remove();
      cleanup();
    }
  };
  const keydownListener = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      dropdown.remove();
      cleanup();
    }
  };
  const cleanup = () => {
    document.removeEventListener('click', outsideClickListener);
    document.removeEventListener('keydown', keydownListener);
    window.removeEventListener('scroll', updatePosition, true);
    window.removeEventListener('resize', updatePosition);
  };
  setTimeout(() => {
    document.addEventListener('click', outsideClickListener);
    document.addEventListener('keydown', keydownListener);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
  }, 0);
}
