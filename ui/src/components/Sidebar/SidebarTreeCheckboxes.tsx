import { useEffect, useRef } from 'react';
import type { SidebarItemKind } from '../../types';
import { SelectionCheckbox } from '../shared/SelectionCheckbox';
import { useSidebarTreeEntry } from './sidebarTreeContext';

export function ScopeCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="scope-focus-checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    />
  );
}

export function SidebarEntryCheckbox({ kind, path, name }: { kind: SidebarItemKind; path: string; name: string }) {
  const entry = useSidebarTreeEntry();
  if (!entry?.selectionActive) return null;
  return (
    <SelectionCheckbox
      className="sidebar-entry-checkbox"
      checked={entry.isSelected(`${kind}:${path}`)}
      label={entry.selectItemLabel.replace('{name}', name)}
      onChange={() => entry.toggleSelected(kind, path)}
    />
  );
}
