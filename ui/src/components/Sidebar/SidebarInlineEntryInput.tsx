import { useEffect, useRef } from 'react';
import type { WorkspaceEntryKind } from '../../types';
import { FilePlusIcon, FolderPlusIcon } from './sidebarEntryIcons';

interface SidebarInlineEntryInputProps {
  kind: WorkspaceEntryKind;
  value: string;
  label: string;
  error: string | null;
  hint: string | null;
  busy: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onBlur: () => void;
}

export function SidebarInlineEntryInput({ kind, value, label, error, hint, busy, onChange, onCommit, onCancel, onBlur }: SidebarInlineEntryInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  // Caret before the extension, VS Code style (".md" -> caret at 0).
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.focus();
    const dot = kind === 'file' ? input.value.lastIndexOf('.') : -1;
    const caret = dot >= 0 ? dot : input.value.length;
    input.setSelectionRange(caret, caret);
  }, [kind]);

  return (
    <div className={`sidebar-entry-input sidebar-entry-input--${kind}`} onClick={(event) => event.stopPropagation()}>
      <div className="sidebar-entry-input__row">
        {kind === 'folder' ? <FolderPlusIcon size={14} /> : <FilePlusIcon size={14} />}
        <input
          ref={ref}
          type="text"
          value={value}
          aria-label={label}
          aria-invalid={Boolean(error)}
          readOnly={busy}
          aria-busy={busy}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              onCommit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
      {error
        ? <div role="alert" className="sidebar-entry-input__message is-error">{error}</div>
        : hint ? <div className="sidebar-entry-input__message">{hint}</div> : null}
    </div>
  );
}
