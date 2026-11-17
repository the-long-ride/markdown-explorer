import { useDialogKeyboard } from '../../hooks/useDialogKeyboard';

interface TableAlignmentInfoDialogProps {
  onClose: () => void;
  title?: string;
  closeLabel?: string;
}

const ALIGNMENT_RULES = [
  {
    label: 'Sequential numbers',
    detail: '1, 2, 3… index columns',
    badge: 'Middle',
    alignClass: 'is-align-center',
  },
  {
    label: 'Numbers',
    detail: 'Decimals, currency, %',
    badge: 'Right',
    alignClass: 'is-align-right',
  },
  {
    label: 'Date / Time',
    detail: 'Jan 1, 2026 · 01/15/2026 · 14:30',
    badge: 'Middle',
    alignClass: 'is-align-center',
  },
  {
    label: 'Checkboxes',
    detail: '[ ], [x], ☐, ☑',
    badge: 'Middle',
    alignClass: 'is-align-center',
  },
  {
    label: 'Boolean',
    detail: 'true / false, yes / no',
    badge: 'Middle',
    alignClass: 'is-align-center',
  },
  {
    label: 'Categories vs. Text',
    detail: 'Repeated tags → Middle · Prose → Left',
    badge: 'Middle / Left',
    alignClass: 'is-align-left',
  },
] as const;

const PREVIEW_ROWS = [
  { index: '1', date: 'Jan 1, 2026', category: 'Alpha', active: '☑', notes: 'Quarterly review', amount: '$1,250.00' },
  { index: '2', date: 'Jan 2, 2026', category: 'Beta', active: '☐', notes: 'Initial draft', amount: '$840.50' },
] as const;

export function TableAlignmentInfoDialog({
  onClose,
  title = 'Intelligent Data Table Alignment',
  closeLabel = 'Close',
}: TableAlignmentInfoDialogProps) {
  useDialogKeyboard({
    open: true,
    onCancel: onClose,
    cancelSelector: '.settings-card__close, .table-align-info-dialog__close',
  });

  return (
    <div
      className="mdn-modal settings-modal-dialog table-align-info-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="table-alignment-info-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings-card table-align-info-card">
        <button
          type="button"
          className="settings-card__close"
          onClick={onClose}
          aria-label={closeLabel}
        >
          &times;
        </button>

        <div className="table-align-info-card__header">
          <h3 id="table-alignment-info-title">{title}</h3>
          <p>
            Auto-aligns columns by content when no manual or Markdown alignment is set.
          </p>
        </div>

        <ul className="table-align-info-rules">
          {ALIGNMENT_RULES.map((rule) => (
            <li key={rule.label} className="table-align-info-rule">
              <div className="table-align-info-rule__text">
                <strong>{rule.label}</strong>
                <span>{rule.detail}</span>
              </div>
              <span className={`table-align-info-badge ${rule.alignClass}`}>{rule.badge}</span>
            </li>
          ))}
        </ul>

        <div className="table-align-info-preview">
          <div className="table-align-info-preview__label">Sample Preview</div>
          <div className="table-align-info-preview__scroll">
            <table className="table-align-info-table">
              <thead>
                <tr>
                  <th className="is-align-center">#</th>
                  <th className="is-align-center">Date</th>
                  <th className="is-align-center">Category</th>
                  <th className="is-align-center">Active</th>
                  <th className="is-align-left">Notes</th>
                  <th className="is-align-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {PREVIEW_ROWS.map((row) => (
                  <tr key={row.index}>
                    <td className="is-align-center">{row.index}</td>
                    <td className="is-align-center">{row.date}</td>
                    <td className="is-align-center">{row.category}</td>
                    <td className="is-align-center">{row.active}</td>
                    <td className="is-align-left">{row.notes}</td>
                    <td className="is-align-right">{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-align-info-card__actions">
          <button
            type="button"
            className="settings-outline-button table-align-info-dialog__close"
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
