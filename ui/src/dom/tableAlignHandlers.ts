import { getTableUiLabels } from './tableUiLabels';
import { inferIntelligentColumnAlignmentFromCells, type IntelligentCellInput } from './intelligentTableAlign';
import type { ResolvedTableColumnAlignment, TableColumnAlignment } from '../themeTypes';

export type { ResolvedTableColumnAlignment, TableColumnAlignment };

/**
 * Infers intelligent alignment for a given column index from a rendered DOM table.
 */
export function inferTableColumnAlignmentFromDom(
  table: HTMLTableElement,
  colIdx: number,
): ResolvedTableColumnAlignment {
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr')).filter(
    (row) => !row.dataset.toggle && !row.id.endsWith('-toggle-row'),
  );
  const cells: IntelligentCellInput[] = rows.map((row) => {
    const cell = (row.cells?.[colIdx] ?? row.children[colIdx]) as HTMLElement | undefined;
    if (!cell) return { text: '' };
    const hasCheckbox = cell.querySelector('input[type="checkbox"]') !== null;
    return { text: cell.textContent ?? '', hasCheckbox };
  });
  return inferIntelligentColumnAlignmentFromCells(cells);
}

function isTableColumnAlignment(value: string | null | undefined): value is TableColumnAlignment {
  return value === 'left' || value === 'center' || value === 'right' || value === 'intelligent';
}

export function getColumnAlignment(th: HTMLElement | null): TableColumnAlignment {
  const userAlign = th?.getAttribute('data-user-col-align');
  if (isTableColumnAlignment(userAlign)) return userAlign;
  const rootAlign = typeof document !== 'undefined' ? document.documentElement?.dataset?.tableAlign : undefined;
  if (rootAlign === 'intelligent') return 'intelligent';
  const dataAlign = th?.getAttribute('data-col-align');
  if (isTableColumnAlignment(dataAlign)) return dataAlign;
  const textAlign = th?.style?.textAlign;
  if (textAlign === 'left' || textAlign === 'center' || textAlign === 'right') return textAlign;
  if (isTableColumnAlignment(rootAlign)) return rootAlign;
  return 'left';
}

export function setColumnAlignment(id: string, colIdx: number, align: TableColumnAlignment): void {
  const table = document.getElementById(id) as HTMLTableElement | null;
  if (!table) return;

  const resolvedAlign: ResolvedTableColumnAlignment =
    align === 'intelligent' ? inferTableColumnAlignmentFromDom(table, colIdx) : align;

  const th = (table.querySelector(`thead th[data-col="${colIdx}"]`) ?? table.querySelectorAll('thead th')[colIdx]) as HTMLElement | null;
  if (th) {
    th.setAttribute('data-user-col-align', align);
    th.setAttribute('data-col-align', align);
    th.style.textAlign = resolvedAlign;
    const btn = th.querySelector<HTMLElement>('.mdn-table-align-btn');
    if (btn) {
      btn.classList.add('is-active');
      btn.setAttribute('data-current-align', align);
    }
  }

  table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
    const cell = (row.cells[colIdx] ?? row.children[colIdx]) as HTMLElement | undefined;
    if (cell) {
      cell.setAttribute('data-user-col-align', align);
      cell.setAttribute('data-col-align', align);
      cell.style.textAlign = resolvedAlign;
    }
  });
}

const ALIGN_ICONS: Record<TableColumnAlignment, string> = {
  left: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>',
  center: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
  right: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>',
  intelligent: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
};

export function showAlignMenu(id: string, colIdx: number, buttonEl: HTMLElement): void {
  const existingAlignDropdown = document.querySelector('.mdn-align-dropdown') as HTMLElement | null;
  const wasOpenForThisButton = existingAlignDropdown && (existingAlignDropdown as any).__triggerButton === buttonEl;
  document.querySelectorAll('.mdn-filter-dropdown, .mdn-align-dropdown').forEach((el) => el.remove());
  if (wasOpenForThisButton) return;

  const table = document.getElementById(id) as HTMLTableElement | null;
  if (!table) return;

  const th = (table.querySelector(`thead th[data-col="${colIdx}"]`) ?? table.querySelectorAll('thead th')[colIdx]) as HTMLElement | null;
  const currentAlign = getColumnAlignment(th);
  const labels = getTableUiLabels(id);

  const dropdown = document.createElement('div');
  dropdown.className = 'mdn-filter-dropdown mdn-align-dropdown';
  (dropdown as any).__triggerButton = buttonEl;

  const list = document.createElement('div');
  list.className = 'mdn-filter-list';
  dropdown.appendChild(list);

  const options: Array<{ align: TableColumnAlignment; label: string }> = [
    { align: 'left', label: labels.alignLeft ?? 'Left' },
    { align: 'center', label: labels.alignMiddle ?? 'Middle' },
    { align: 'right', label: labels.alignRight ?? 'Right' },
    { align: 'intelligent', label: labels.alignIntelligent },
  ];

  options.forEach((opt) => {
    const isActive = currentAlign === opt.align;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `mdn-filter-item mdn-align-item${isActive ? ' is-active is-selected' : ''}`;
    item.dataset.align = opt.align;
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', String(isActive));
    item.innerHTML = `${ALIGN_ICONS[opt.align]}<span>${opt.label}</span>`;

    item.onclick = (e) => {
      e.stopPropagation();
      setColumnAlignment(id, colIdx, opt.align);
      buttonEl.classList.add('is-active');
      dropdown.remove();
    };
    list.appendChild(item);
  });

  document.body.appendChild(dropdown);
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
    const dropdownWidth = dropdown.offsetWidth || 140;
    const viewportWidth = window.innerWidth;
    let leftPos = rect.left;
    if (rect.left + dropdownWidth > viewportWidth) leftPos = rect.right - dropdownWidth;
    leftPos = Math.max(12, Math.min(leftPos, viewportWidth - dropdownWidth - 12));
    dropdown.style.left = `${leftPos}px`;
  };

  const outsideClickListener = (e: MouseEvent) => {
    if (!dropdown.contains(e.target as Node) && e.target !== buttonEl && !buttonEl.contains(e.target as Node)) {
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
  updatePosition();
  setTimeout(() => {
    document.addEventListener('click', outsideClickListener);
    document.addEventListener('keydown', keydownListener);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
  }, 0);
}
