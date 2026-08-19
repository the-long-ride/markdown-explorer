import { useMemo, useState } from 'react';
import { setFilteredSelection } from './exportSelectionModel';
import { SwitchButton } from '../shared/SwitchButton';
import { SearchIcon } from '../shared/icons';

export interface ExportMultiSelectItem {
  id: string;
  label: string;
  detail?: string;
}

export function ExportMultiSelect({
  ariaLabel,
  items,
  selected,
  onChange,
  searchPlaceholder,
}: {
  ariaLabel: string;
  items: readonly ExportMultiSelectItem[];
  selected: ReadonlySet<string>;
  onChange: (selection: Set<string>) => void;
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => !needle
      || `${item.label} ${item.detail ?? ''}`.toLocaleLowerCase().includes(needle));
  }, [items, query]);

  const setVisible = (checked: boolean) => {
    onChange(setFilteredSelection(selected, filtered.map((item) => item.id), checked));
  };

  const toggle = (id: string) => {
    onChange(setFilteredSelection(selected, [id], !selected.has(id)));
  };

  return (
    <div className="export-multi-select" aria-label={ariaLabel}>
      <div className="export-multi-select__toolbar">
        <label className="export-multi-select__search">
          <SearchIcon size={12} />
          <input
            type="search"
            value={query}
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="export-multi-select__bulk">
          <button type="button" onClick={() => setVisible(true)} disabled={filtered.length === 0}>Select all</button>
          <button type="button" onClick={() => setVisible(false)} disabled={filtered.length === 0}>Unselect all</button>
        </div>
      </div>
      <div className="export-multi-select__rows">
        {filtered.map((item) => (
          <div className="export-multi-select__row" key={item.id}>
            <div className="export-multi-select__identity">
              <span>{item.label}</span>
              {item.detail && item.detail !== item.label && <small>{item.detail}</small>}
            </div>
            <SwitchButton
              checked={selected.has(item.id)}
              label={`Include ${item.detail ?? item.label}`}
              onClick={() => toggle(item.id)}
            />
          </div>
        ))}
        {filtered.length === 0 && <div className="export-multi-select__empty">No matches</div>}
      </div>
    </div>
  );
}
