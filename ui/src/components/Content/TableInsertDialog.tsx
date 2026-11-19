import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatTableDimensions, getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import { useDialogKeyboard } from '../../hooks/useDialogKeyboard';

export interface TableInsertDialogProps {
  open: boolean;
  language: string;
  onInsert: (rows: number, cols: number) => void;
  onClose: () => void;
}

const GRID_SIZE = 7;

export function TableInsertDialog({
  open,
  language,
  onInsert,
  onClose,
}: TableInsertDialogProps) {
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  const [isLocked, setIsLocked] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const titleId = useId();
  const colsInputRef = useRef<HTMLInputElement>(null);
  const labels = getEditorUiTranslations(language);

  useEffect(() => {
    if (open) {
      setCols(3);
      setRows(3);
      setIsLocked(false);
      setIsDrawing(false);
      const timer = setTimeout(() => {
        colsInputRef.current?.focus();
        colsInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const applyDimensions = (c: number, r: number) => {
    const clampedCols = Math.max(1, Math.min(20, c || 1));
    const clampedRows = Math.max(1, Math.min(50, r || 1));
    onInsert(clampedRows, clampedCols);
    onClose();
  };

  useDialogKeyboard({
    open,
    onCancel: onClose,
    onConfirm: () => {
      applyDimensions(cols, rows);
    },
    cancelSelector: '.table-insert-dialog__button--cancel',
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyDimensions(cols, rows);
  };

  return createPortal(
    <div
      className="table-insert-dialog-backdrop"
      data-testid="table-insert-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="table-insert-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
        data-testid="table-insert-dialog"
      >
        <h2 id={titleId} className="table-insert-dialog__title">
          {labels.insertTable}
        </h2>

        <div className="table-insert-dialog__fields">
          <label className="table-insert-dialog__field">
            <span className="table-insert-dialog__label">{labels.tableColumns}</span>
            <input
              ref={colsInputRef}
              type="number"
              min={1}
              max={20}
              value={cols}
              onChange={(e) => {
                setIsLocked(true);
                setCols(parseInt(e.target.value, 10) || 1);
              }}
              className="table-insert-dialog__input"
              data-testid="table-insert-cols"
              required
            />
          </label>

          <label className="table-insert-dialog__field">
            <span className="table-insert-dialog__label">{labels.tableRows}</span>
            <input
              type="number"
              min={1}
              max={50}
              value={rows}
              onChange={(e) => {
                setIsLocked(true);
                setRows(parseInt(e.target.value, 10) || 1);
              }}
              className="table-insert-dialog__input"
              data-testid="table-insert-rows"
              required
            />
          </label>
        </div>

        <div className="table-insert-dialog__grid-wrapper">
          <div className="table-insert-dialog__grid-status" data-testid="table-insert-grid-status">
            <span>{formatTableDimensions(labels.tableDimensions, Math.max(1, rows), Math.max(1, cols))}</span>
            {isLocked && <span className="table-insert-dialog__grid-status-badge" data-testid="table-insert-grid-locked-badge">✓</span>}
          </div>
          <div
            className={`table-insert-dialog__grid ${isLocked ? 'is-locked' : ''}`}
            role="grid"
            aria-label={labels.insertTable}
            data-testid="table-insert-grid"
            onPointerDown={() => {
              setIsDrawing(true);
            }}
            onPointerUp={() => {
              setIsDrawing(false);
              setIsLocked(true);
            }}
            onMouseLeave={() => {
              setIsDrawing(false);
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, idx) => {
              const r = Math.floor(idx / GRID_SIZE) + 1;
              const c = (idx % GRID_SIZE) + 1;
              const isHighlighted = c <= cols && r <= rows;
              const isCorner = c === cols && r === rows;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  className={`table-insert-dialog__grid-cell ${isHighlighted ? 'is-highlighted' : ''} ${isCorner ? 'is-corner' : ''}`}
                  data-row={r}
                  data-col={c}
                  data-testid={`table-grid-cell-${r}-${c}`}
                  aria-label={`${c} × ${r}`}
                  tabIndex={-1}
                  onPointerEnter={(e) => {
                    if (isDrawing || (!isLocked && e.buttons === 0)) {
                      setCols(c);
                      setRows(r);
                    }
                  }}
                  onClick={() => {
                    setCols(c);
                    setRows(r);
                    setIsLocked(true);
                  }}
                  onDoubleClick={() => {
                    setCols(c);
                    setRows(r);
                    setIsLocked(true);
                    applyDimensions(c, r);
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="table-insert-dialog__actions">
          <button
            type="button"
            className="table-insert-dialog__button table-insert-dialog__button--cancel"
            data-dialog-cancel="true"
            onClick={onClose}
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            className="table-insert-dialog__button table-insert-dialog__button--submit"
            data-testid="table-insert-confirm"
          >
            {labels.apply || 'Insert'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
