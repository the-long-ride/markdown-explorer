import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  WidgetType,
} from '@codemirror/view';
import { redo, undo } from '@codemirror/commands';
import { isRedoChord, isUndoChord } from './editorUx';
import {
  type Extension,
  Prec,
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

    const labels = getEditorUiTranslations(this.getLanguage());

    const bar = document.createElement('div');
    bar.className = 'cm-table-widget__bar';

    const info = document.createElement('span');
    info.className = 'cm-table-widget__info';
    info.textContent = formatTableDimensions(labels.tableDimensions, this.data.rows.length, this.data.headers.length);
    bar.appendChild(info);

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'cm-table-widget__toggle-btn tooltip-container';
    toggleBtn.setAttribute('data-tooltip-pos', 'below');
    toggleBtn.setAttribute('data-tooltip-align', 'right');
    toggleBtn.setAttribute('aria-label', labels.viewRawMarkdown);
    const toggleIcon = createSvgIcon(TABLE_ICON_PATHS.rawMarkdown, 13);
    toggleBtn.appendChild(toggleIcon);
    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = labels.viewRawMarkdown;
    toggleBtn.appendChild(toggleLabel);
    const toggleTip = document.createElement('span');
    toggleTip.className = 'tooltip-text';
    toggleTip.textContent = labels.viewRawMarkdown;
    toggleBtn.appendChild(toggleTip);
    toggleBtn.onclick = () => {
      view.dispatch({ effects: toggleTableRawEffect.of(this.from) });
    };
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

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    this.data.headers.forEach((headerText, colIdx) => {
      const th = document.createElement('th');
      th.className = 'cm-table-cell cm-table-cell--header';
      th.contentEditable = 'true';
      th.spellcheck = false;
      th.textContent = headerText;
      th.setAttribute('data-row', '-1');
      th.setAttribute('data-col', String(colIdx));
      const align = this.data.alignments[colIdx];
      if (align) th.style.textAlign = align;

      selection.bindCell(th, -1, colIdx);

      th.onblur = () => {
        if (selection.hasMultiSelection() || selection.isClearing()) return;
        const text = th.textContent ?? '';
        if (text !== headerText) {
          updateDocWith(updateCell(this.data, -1, colIdx, text));
        }
      };

      th.oncontextmenu = (e) => {
        showContextMenu(
          e,
          this.data,
          -1,
          colIdx,
          this.from,
          this.to,
          view,
          this.getLanguage,
          () => exitTableToNewLine(view, this.to),
          () => view.dispatch({ effects: toggleTableRawEffect.of(this.from) }),
        );
      };

      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    this.data.rows.forEach((row, rowIdx) => {
      const tr = document.createElement('tr');
      row.forEach((cellText, colIdx) => {
        const td = document.createElement('td');
        td.className = 'cm-table-cell';
        td.contentEditable = 'true';
        td.spellcheck = false;
        td.textContent = cellText;
        td.setAttribute('data-row', String(rowIdx));
        td.setAttribute('data-col', String(colIdx));
        const align = this.data.alignments[colIdx];
        if (align) td.style.textAlign = align;

        selection.bindCell(td, rowIdx, colIdx);

        td.onblur = () => {
          if (selection.hasMultiSelection() || selection.isClearing()) return;
          const text = td.textContent ?? '';
          if (text !== cellText) {
            updateDocWith(updateCell(this.data, rowIdx, colIdx, text));
          }
        };

        td.oncontextmenu = (e) => {
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

        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    selection.restoreStyles();

    const focusCell = (r: number, c: number) => container.querySelector<HTMLElement>(`[data-row="${r}"][data-col="${c}"]`)?.focus();

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
      if (handleUndoRedo(e)) return;
      if (selection.handleKeyDown(e)) return;
      const target = e.target as HTMLElement;
      if (!target || !target.classList.contains('cm-table-cell')) return;

      const rIdx = parseInt(target.getAttribute('data-row') ?? '0', 10);
      const cIdx = parseInt(target.getAttribute('data-col') ?? '0', 10);
      const isLastRow = rIdx === this.data.rows.length - 1;

      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (!isLastRow && rIdx !== -1) focusCell(rIdx + 1, cIdx);
        else if (rIdx === -1 && this.data.rows.length > 0) focusCell(0, cIdx);
        else exitTableToNewLine(view, this.to);
        return;
      }

      if (e.key === 'ArrowDown' && isLastRow) {
        e.preventDefault();
        exitTableToNewLine(view, this.to);
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (!e.shiftKey) {
          if (cIdx + 1 < this.data.headers.length) focusCell(rIdx, cIdx + 1);
          else if (rIdx + 1 < this.data.rows.length) focusCell(rIdx + 1, 0);
          else updateDocWith(insertRow(this.data, rIdx, 'below'));
        } else {
          if (cIdx > 0) focusCell(rIdx, cIdx - 1);
          else if (rIdx > 0) focusCell(rIdx - 1, this.data.headers.length - 1);
          else if (rIdx === 0) focusCell(-1, this.data.headers.length - 1);
        }
      }
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
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-raw-table-banner__btn tooltip-container';
    btn.setAttribute('data-tooltip-pos', 'below');
    btn.setAttribute('aria-label', this.labels.viewRenderedTable);
    const rawIcon = createTableGridIcon(13);
    btn.appendChild(rawIcon);
    const rawLabel = document.createElement('span');
    rawLabel.textContent = this.labels.viewRenderedTable;
    btn.appendChild(rawLabel);
    const rawTip = document.createElement('span');
    rawTip.className = 'tooltip-text';
    rawTip.textContent = this.labels.viewRenderedTable;
    btn.appendChild(rawTip);
    btn.onclick = () => {
      view.dispatch({ effects: toggleTableRawEffect.of(this.offset) });
    };
    div.appendChild(btn);
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

  const backspaceHandler = Prec.high(
    keymap.of([
      {
        key: 'Backspace',
        run(view) {
          const { from, empty } = view.state.selection.main;
          if (!empty) return false;
          const line = view.state.doc.lineAt(from);
          if (line.from === from && line.from === line.to && line.number > 1) {
            const ranges = findTableRanges(view.state.doc.toString());
            const tableBefore = ranges.find((r) => r.to === line.from - 1);
            if (tableBefore) {
              view.dispatch({
                changes: { from: line.from - 1, to: line.to },
                selection: { anchor: tableBefore.from },
              });
              const lastWidget = view.dom.querySelector('.cm-table-widget:last-of-type');
              const lastCell = lastWidget?.querySelector('tbody tr:last-child td:last-child') as HTMLElement;
              lastCell?.focus();
              return true;
            }
          }
          return false;
        },
      },
    ]),
  );

  return [rawTableOffsetsField, tableVisualField, clickBelowHandler, backspaceHandler];
}
