import { useMemo, useState } from 'react';
import type { ExportWorkspaceResourceInfo } from '../../types/hostMessages';
import { setFilteredSelection } from './exportSelectionModel';
import { SwitchButton } from '../shared/SwitchButton';
import { SearchIcon } from '../shared/icons';

function visibleResources(resources: readonly ExportWorkspaceResourceInfo[]) {
  return resources.filter((item) => !item.relativePath.replace(/\\/g, '/').split('/').includes('.git'));
}

function foldersFor(resources: readonly ExportWorkspaceResourceInfo[]): string[] {
  const folders = new Set<string>();
  for (const resource of resources) {
    const parts = resource.relativePath.replace(/\\/g, '/').split('/').slice(0, -1);
    for (let length = 1; length <= parts.length; length += 1) {
      folders.add(parts.slice(0, length).join('/'));
    }
  }
  return [...folders].sort((a, b) => a.localeCompare(b));
}

export function ExportAdditionalFilesPanel({
  resources,
  selectedPaths,
  onChange,
  loading = false,
  error = '',
}: {
  resources: readonly ExportWorkspaceResourceInfo[];
  selectedPaths: ReadonlySet<string>;
  onChange: (selection: Set<string>) => void;
  loading?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const safeResources = useMemo(() => visibleResources(resources), [resources]);
  const folders = useMemo(() => foldersFor(safeResources), [safeResources]);
  const needle = query.trim().toLocaleLowerCase();
  const filteredFolders = folders.filter((folder) => !needle || folder.toLocaleLowerCase().includes(needle));
  const filteredFiles = safeResources.filter((resource) => !needle || resource.relativePath.toLocaleLowerCase().includes(needle));

  const folderFiles = (folder: string) => safeResources
    .filter((resource) => resource.relativePath.startsWith(`${folder}/`))
    .map((resource) => resource.relativePath);

  const setVisible = (checked: boolean) => {
    const paths = new Set(filteredFiles.map((resource) => resource.relativePath));
    for (const folder of filteredFolders) for (const path of folderFiles(folder)) paths.add(path);
    onChange(setFilteredSelection(selectedPaths, [...paths], checked));
  };

  const toggleFolder = (folder: string) => {
    const paths = folderFiles(folder);
    const checked = paths.length > 0 && paths.every((path) => selectedPaths.has(path));
    onChange(setFilteredSelection(selectedPaths, paths, !checked));
  };

  const toggleFile = (path: string) => {
    onChange(setFilteredSelection(selectedPaths, [path], !selectedPaths.has(path)));
  };

  return (
    <section className="export-extra-files" aria-label="Additional workspace files">
      <div className="export-extra-files__heading">
        <div><strong>Additional workspace files</strong><small>Optional files packaged with web exports</small></div>
        <span>{selectedPaths.size} selected</span>
      </div>
      <div className="export-multi-select__toolbar">
        <label className="export-multi-select__search">
          <SearchIcon size={12} />
          <input
            type="search"
            value={query}
            aria-label="Search workspace files"
            placeholder="Search workspace files"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="export-multi-select__bulk">
          <button type="button" onClick={() => setVisible(true)} disabled={loading}>Select all</button>
          <button type="button" onClick={() => setVisible(false)} disabled={loading}>Unselect all</button>
        </div>
      </div>
      <div className="export-extra-files__rows">
        {loading && <div className="export-multi-select__empty">Loading workspace files…</div>}
        {!loading && error && <div className="export-multi-select__empty is-error">{error}</div>}
        {!loading && !error && filteredFolders.map((folder) => {
          const paths = folderFiles(folder);
          const checked = paths.length > 0 && paths.every((path) => selectedPaths.has(path));
          return (
            <div className="export-multi-select__row is-folder" key={`folder:${folder}`}>
              <div className="export-multi-select__identity"><span>{folder}</span><small>{paths.length} files</small></div>
              <SwitchButton checked={checked} label={`Include folder ${folder}`} onClick={() => toggleFolder(folder)} />
            </div>
          );
        })}
        {!loading && !error && filteredFiles.map((resource) => (
          <div className="export-multi-select__row" key={resource.relativePath}>
            <div className="export-multi-select__identity"><span>{resource.relativePath}</span><small>{resource.size.toLocaleString()} bytes</small></div>
            <SwitchButton
              checked={selectedPaths.has(resource.relativePath)}
              label={`Include ${resource.relativePath}`}
              onClick={() => toggleFile(resource.relativePath)}
            />
          </div>
        ))}
        {!loading && !error && filteredFolders.length === 0 && filteredFiles.length === 0 && (
          <div className="export-multi-select__empty">No matches</div>
        )}
      </div>
    </section>
  );
}
