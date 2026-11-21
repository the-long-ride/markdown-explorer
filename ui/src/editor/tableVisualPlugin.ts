import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { redo, undo } from '@codemirror/commands';
import { isRedoChord, isUndoChord } from './editorUx';
import {
  type Extension,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
} from '@codemirror/state';
import { formatTableDimensions, getEditorUiTranslations } from '../contexts/editorUiTranslations';
import {
  findTableRanges,
  insertRow,
  serializeMarkdownTable,
  tablesEqual,
  updateCell,
  type TableData,
} from './tableEditor';
import { createSvgIcon, createTableGridIcon, TABLE_ICON_PATHS } from './tableIcons';
import { showContextMenu } from './tableContextMenu';
import { TableSelectionController } from './tableSelection';
import {
  createTableBoundaryKeymap,
  displayTextToMarkdownCell,
  getCellSelectionOffsets,
  handleTableCellKeyDown,
  markdownCellToDisplayText,
  normalizeCellLiveInput,
  setCellCaretOffset,
  TABLE_CELL_COMMIT_EVENT,
} from './tableCellEditing';

export const toggleTableRawEffect = StateEffect.define<number>();

export const rawTableOffsetsField = StateField.define<Set<number>>({
  create: () => new Set<number>(),
  update(value, tr) {
    let next = value;
    if (tr.docChanged && next.size > 0) {
      const mapped = new Set<number>();
      for (const off of next) mapped.add(tr.changes.mapPos(off));
      next = mapped;
    }
    for (const effect of tr.effects) {
      if (effect.is(toggleTableRawEffect)) {
        const off = effect.value;
        const set = new Set(next);
        if (set.has(off)) set.delete(off); else set.add(off);
        next = set;
      }
    }
    return next;
  },
});

export function exitTableToNewLine(view: EditorView, to: number) {
  const doc = view.state.doc;
  const docText = doc.toString();
  if (to >= doc.length) {
    const insertText = docText.endsWith('\n') ? '' : '\n';
    if (insertText) {
      view.dispatch({ changes: { from: doc.length, insert: insertText }, selection: { anchor: doc.length + insertText.length }, scrollIntoView: true });
    } else {
      view.dispatch({ selection: { anchor: doc.length }, scrollIntoView: true });
    }
  } else {
    view.dispatch({ selection: { anchor: Math.min(doc.length, to + 1) }, scrollIntoView: true });
  }
  view.focus();
}

function createTooltipButton(
  className: string,
  labelText: string,
  icon: SVGElement,
  onClick: () => void,
  tooltipAlign?: string,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `${className} tooltip-container`;
  btn.setAttribute('data-tooltip-pos', 'below');
  if (tooltipAlign) btn.setAttribute('data-tooltip-align', tooltipAlign);
  btn.setAttribute('aria-label', labelText);
  const label = document.createElement('span');
  label.textContent = labelText;
  const tip = document.createElement('span');
  tip.className = 'tooltip-text';
  tip.textContent = labelText;
  btn.append(icon, label, tip);
  btn.onclick = onClick;
  return btn;
}

export function exitTableAbove(view: EditorView, from: number) {
  if (from <= 0) {
    view.dispatch({ changes: { from: 0, insert: '\n' }, selection: { anchor: 0 }, scrollIntoView: true });
  } else {
    view.dispatch({ selection: { anchor: Math.max(0, from - 1) }, scrollIntoView: true });
  }
  view.focus();
}

class TableWidget extends WidgetType {
  private selection?: TableSelectionController;

  constructor(
    readonly data: TableData,
    readonly from: number,
    readonly to: number,
    readonly getLanguage: () => string,
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return other.from === this.from && other.to === this.to && tablesEqual(other.data, this.data);
  }

  ignoreEvent(): boolean {
    return true;
  }

  destroy(): void {
    this.selection?.destroy();
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-table-widget';
    container.setAttribute('data-testid', 'cm-table-widget');
    container.setAttribute('data-table-from', String(this.from));

    const labels = getEditorUiTranslations(this.getLanguage());

    const bar = document.createElement('div');
    bar.className = 'cm-table-widget__bar';

    const info = document.createElement('span');
    info.className = 'cm-table-widget__info';
    info.textContent = formatTableDimensions(labels.tableDimensions, this.data.rows.length, this.data.headers.length);
    bar.appendChild(info);

    const toggleBtn = createTooltipButton(
      'cm-table-widget__toggle-btn',
      labels.viewRawMarkdown,
      createSvgIcon(TABLE_ICON_PATHS.rawMarkdown, 13),
      () => view.dispatch({ effects: toggleTableRawEffect.of(this.from) }),
      'right',
    );
    bar.appendChild(toggleBtn);

    container.appendChild(bar);

    const table = document.createElement('table');
    table.className = 'cm-table-widget__table';

    const updateDocWith = (nextData: TableData) => {
      const nextMarkdown = serializeMarkdownTable(nextData);
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: nextMarkdown },
        scrollIntoView: true,
      });
    };

    const selection = new TableSelectionController({
      view,
      tableFrom: this.from,
      container,
      table,
      getData: () => this.data,
      updateDocWith,
    });
    this.selection = selection;

    const commitByCell = new WeakMap<HTMLElement, () => number | null>();

    const createCell = (tag: 'th' | 'td', rawText: string, rowIdx: number, colIdx: number): HTMLElement => {
      const cell = document.createElement(tag);
      cell.className = tag === 'th' ? 'cm-table-cell cm-table-cell--header' : 'cm-table-cell';
      cell.contentEditable = 'true';
      cell.tabIndex = 0;
      cell.spellcheck = false;
      const initialDisplay = markdownCellToDisplayText(rawText);
      cell.textContent = initialDisplay;
      cell.setAttribute('data-row', String(rowIdx));
      cell.setAttribute('data-col', String(colIdx));
      const align = this.data.alignments[colIdx];
      if (align) cell.style.textAlign = align;

      selection.bindCell(cell, rowIdx, colIdx);
      cell.oninput = () => normalizeCellLiveInput(cell);

      const commitIfEdited = (): number | null => {
        if (selection.hasMultiSelection() || selection.isClearing() || !container.isConnected) return null;
        const currentDisplay = cell.textContent ?? '';
        if (currentDisplay === initialDisplay) return null;
        const nextMarkdown = displayTextToMarkdownCell(currentDisplay);
        if (nextMarkdown === rawText) return null;
        updateDocWith(updateCell(this.data, rowIdx, colIdx, nextMarkdown));
        return findTableRanges(view.state.doc.toString()).find((r) => r.from === this.from)?.to ?? null;
      };
      commitByCell.set(cell, commitIfEdited);

      cell.onblur = () => {
        commitIfEdited();
      };

      cell.addEventListener(TABLE_CELL_COMMIT_EVENT, () => {
        const caretOffset = getCellSelectionOffsets(cell).end;
        const nextMarkdown = displayTextToMarkdownCell(cell.textContent ?? '');
        if (nextMarkdown !== rawText) {
          updateDocWith(updateCell(this.data, rowIdx, colIdx, nextMarkdown));
        }
        const replacement = view.dom.querySelector<HTMLElement>(
          `[data-table-from="${this.from}"] [data-row="${rowIdx}"][data-col="${colIdx}"]`,
        );
        if (replacement) {
          replacement.focus();
          setCellCaretOffset(replacement, caretOffset);
        }
      });

      cell.oncontextmenu = (e) => {
        showContextMenu(
          e,
          this.data,
          rowIdx,
          colIdx,
          this.from,
          this.to,
          view,
          this.getLanguage,
          () => exitTableToNewLine(view, this.to),
          () => view.dispatch({ effects: toggleTableRawEffect.of(this.from) }),
        );
      };

      return cell;
    };

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    this.data.headers.forEach((headerText, colIdx) => {
      headerRow.appendChild(createCell('th', headerText, -1, colIdx));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    this.data.rows.forEach((row, rowIdx) => {
      const tr = document.createElement('tr');
      row.forEach((cellText, colIdx) => {
        tr.appendChild(createCell('td', cellText, rowIdx, colIdx));
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    selection.restoreStyles();

    const focusCell = (r: number, c: number) => {
      const selector = `[data-row="${r}"][data-col="${c}"]`;
      container.querySelector<HTMLElement>(selector)?.focus();
      if (!container.isConnected) {
        view.dom.querySelector<HTMLElement>(`[data-table-from="${this.from}"] ${selector}`)?.focus();
      }
    };

    const commitBeforeExit = (target: HTMLElement): number => commitByCell.get(target)?.() ?? this.to;

    const handleUndoRedo = (e: KeyboardEvent): boolean => {
      const isUndo = isUndoChord(e);
      const isRedo = !isUndo && isRedoChord(e);
      if (!isUndo && !isRedo) return false;
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as HTMLElement | null;
      const r = target?.getAttribute?.('data-row');
      const c = target?.getAttribute?.('data-col');
      if (target?.classList.contains('cm-table-cell')) target.blur();
      if (isUndo) undo(view);
      else redo(view);
      if (!container.querySelector('.is-multi-selected') && r != null && c != null) {
        focusCell(parseInt(r, 10), parseInt(c, 10));
      }
      return true;
    };

    container.onkeydown = (e) => {
      if (handleUndoRedo(e)) return;
    };

    table.onkeydown = (e) => {
      if (handleUndoRedo(e) || selection.handleKeyDown(e)) return;
      const target = e.target as HTMLElement;
      if (!target || !target.classList.contains('cm-table-cell')) return;
      handleTableCellKeyDown({
        e,
        target,
        rowCount: this.data.rows.length,
        colCount: this.data.headers.length,
        focusCell,
        commitBeforeExit,
        onExitBelow: (to) => exitTableToNewLine(view, to),
        onExitAbove: () => exitTableAbove(view, this.from),
        onInsertRowBelow: (rIdx) => {
          updateDocWith(insertRow(this.data, rIdx, 'below'));
          focusCell(rIdx + 1, 0);
        },
      });
    };

    container.appendChild(table);
    return container;
  }
}

class RawTableBannerWidget extends WidgetType {
  constructor(
    readonly offset: number,
    readonly labels: { viewRenderedTable: string },
  ) {
    super();
  }

  eq(other: RawTableBannerWidget): boolean {
    return other.offset === this.offset;
  }

  ignoreEvent(): boolean {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const div = document.createElement('div');
    div.className = 'cm-raw-table-banner';
    div.appendChild(
      createTooltipButton(
        'cm-raw-table-banner__btn',
        this.labels.viewRenderedTable,
        createTableGridIcon(13),
        () => view.dispatch({ effects: toggleTableRawEffect.of(this.offset) }),
      ),
    );
    return div;
  }
}

function buildTableDecorations(
  state: EditorState,
  rawOffsets: Set<number>,
  getLanguage: () => string,
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const docText = state.doc.toString();
  const ranges = findTableRanges(docText);
  const labels = getEditorUiTranslations(getLanguage());

  for (const r of ranges) {
    if (rawOffsets.has(r.from)) {
      const banner = new RawTableBannerWidget(r.from, labels);
      builder.add(r.from, r.from, Decoration.widget({ widget: banner, side: -1, block: true }));
    } else {
      const widget = new TableWidget(r.data, r.from, r.to, getLanguage);
      builder.add(r.from, r.to, Decoration.replace({ widget, block: true }));
    }
  }

  return builder.finish();
}

export function createTableVisualExtension(getLanguage: () => string): Extension {
  const tableVisualField = StateField.define<DecorationSet>({
    create(state) {
      return buildTableDecorations(state, new Set(), getLanguage);
    },
    update(decorations, tr) {
      const rawOffsets = tr.state.field(rawTableOffsetsField);
      if (tr.docChanged || tr.effects.some((e) => e.is(toggleTableRawEffect))) {
        return buildTableDecorations(tr.state, rawOffsets, getLanguage);
      }
      return decorations.map(tr.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  const clickBelowHandler = EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0) return false;
      const target = event.target as HTMLElement;
      if (target.closest('.cm-table-widget, .cm-table-context-menu, button, input')) return false;

      const widgets = view.dom.querySelectorAll('.cm-table-widget');
      if (widgets.length === 0) return false;
      const lastWidget = widgets[widgets.length - 1];
      const rect = lastWidget.getBoundingClientRect();

      if (event.clientY > rect.bottom) {
        const ranges = findTableRanges(view.state.doc.toString());
        const lastRange = ranges[ranges.length - 1];
        if (lastRange && lastRange.to >= view.state.doc.length) {
          event.preventDefault();
          exitTableToNewLine(view, lastRange.to);
          return true;
        }
      }
      return false;
    },
  });

  const boundaryKeymap = createTableBoundaryKeymap(rawTableOffsetsField);

  return [rawTableOffsetsField, tableVisualField, clickBelowHandler, boundaryKeymap];
}
