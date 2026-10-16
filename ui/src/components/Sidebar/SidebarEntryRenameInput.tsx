import { useEffect, useRef } from 'react';
interface Props {
  value: string; label: string; file: boolean; error: string | null; busy: boolean;
  onChange: (value: string) => void; onCommit: () => void; onCancel: (restore?: boolean) => void;
}
export function SidebarEntryRenameInput({ value, label, file, error, busy, onChange, onCommit, onCancel }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.focus();
    const dot = file ? input.value.lastIndexOf('.') : -1;
    input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
  }, [file]);
  return <span className="sidebar-entry-rename" onClick={event => event.stopPropagation()}>
    <input ref={ref} value={value} aria-label={label} aria-invalid={Boolean(error)} aria-busy={busy} readOnly={busy} spellCheck={false}
      onChange={event => onChange(event.target.value)} onBlur={() => { if (!busy) onCancel(false); }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing || busy) return;
        if (event.key === 'Enter') { event.preventDefault(); onCommit(); }
        if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
      }} />
    {error && <span className="sidebar-entry-input__message is-error" role="alert">{error}</span>}
  </span>;
}
