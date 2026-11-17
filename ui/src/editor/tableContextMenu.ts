import type { EditorView } from '@codemirror/view';
import {
  type TableData,
  serializeMarkdownTable,
  insertRow,
  deleteRow,
  insertColumn,
  deleteColumn,
} from './tableEditor';
import { getEditorUiTranslations } from '../contexts/editorUiTranslations';
import { TABLE_ICON_PATHS, createSvgIcon } from './tableIcons';

export function showContextMenu(
  event: MouseEvent,
  data: TableData,
  rowIdx: number,
  colIdx: number,
  from: number,
  to: number,
  view: EditorView,
  getLanguage: () => string,
  onInsertLineBelow: () => void,
  onToggleRaw: () => void,
): void {
  event.preventDefault();
  event.stopPropagation();

  const existing = document.querySelector('.cm-table-context-menu');
  if (existing) existing.remove();

  const labels = getEditorUiTranslations(getLanguage());
  const menu = document.createElement('div');
  menu.className = 'cm-table-context-menu';
  menu.setAttribute('role', 'menu');

  const updateDocWith = (nextData: TableData) => {
    const nextMarkdown = serializeMarkdownTable(nextData);
    view.dispatch({
      changes: { from, to, insert: nextMarkdown },
      scrollIntoView: true,
    });
  };

  const addItem = (label: string, action: () => void, disabled = false, iconSvg?: SVGElement) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-table-context-menu__item';
    btn.disabled = disabled;
    if (iconSvg) {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'cm-table-context-menu__item-icon';
      iconWrap.appendChild(iconSvg);
      btn.appendChild(iconWrap);
    }
    const labelSpan = document.createElement('span');
    labelSpan.className = 'cm-table-context-menu__item-label';
    labelSpan.textContent = label;
    btn.appendChild(labelSpan);
    btn.onclick = () => {
      menu.remove();
      action();
    };
    menu.appendChild(btn);
  };

  const addDivider = () => {
    const div = document.createElement('div');
    div.className = 'cm-table-context-menu__divider';
    menu.appendChild(div);
  };

  addItem(labels.insertTableRowAbove, () => updateDocWith(insertRow(data, rowIdx === -1 ? 0 : rowIdx, 'above')), false, createSvgIcon(TABLE_ICON_PATHS.rowAbove));
  addItem(labels.insertTableRowBelow, () => updateDocWith(insertRow(data, rowIdx === -1 ? 0 : rowIdx, 'below')), false, createSvgIcon(TABLE_ICON_PATHS.rowBelow));
  addItem(labels.deleteTableRow, () => updateDocWith(deleteRow(data, rowIdx)), rowIdx === -1, createSvgIcon(TABLE_ICON_PATHS.rowDelete));
  addDivider();
  addItem(labels.insertTableColumnLeft, () => updateDocWith(insertColumn(data, colIdx, 'left')), false, createSvgIcon(TABLE_ICON_PATHS.colLeft));
  addItem(labels.insertTableColumnRight, () => updateDocWith(insertColumn(data, colIdx, 'right')), false, createSvgIcon(TABLE_ICON_PATHS.colRight));
  addItem(labels.deleteTableColumn, () => updateDocWith(deleteColumn(data, colIdx)), data.headers.length <= 1, createSvgIcon(TABLE_ICON_PATHS.colDelete));
  addDivider();
  addItem(labels.insertLineBelow, onInsertLineBelow, false, createSvgIcon(TABLE_ICON_PATHS.rowBelow));
  addItem(labels.viewRawMarkdown, onToggleRaw, false, createSvgIcon(TABLE_ICON_PATHS.rawMarkdown));

  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  const posX = Math.min(window.innerWidth - rect.width - 8, Math.max(8, event.clientX));
  const posY = Math.min(window.innerHeight - rect.height - 8, Math.max(8, event.clientY));
  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;

  const closeMenu = (e: Event) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      cleanup();
    }
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      menu.remove();
      cleanup();
    }
  };

  const cleanup = () => {
    document.removeEventListener('mousedown', closeMenu);
    document.removeEventListener('keydown', handleKey);
  };

  document.addEventListener('mousedown', closeMenu);
  document.addEventListener('keydown', handleKey);
}
