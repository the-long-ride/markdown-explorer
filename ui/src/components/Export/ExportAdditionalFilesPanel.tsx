import { useMemo, useState } from 'react';
import { EXPORT_SCOPE_TRANSLATIONS, formatFeatureText, type ExportCenterFeatureTranslations } from '../../contexts/exportScopeTranslations';
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
    for (let length = 1; length <= parts.length; length += 1) folders.add(parts.slice(0, length).join('/'));
  }
  return [...folders].sort((a, b) => a.localeCompare(b));
}

export function ExportAdditionalFilesPanel({
  resources, selectedPaths, onChange, loading = false, error = '', translations,
}: {
  resources: readonly ExportWorkspaceResourceInfo[];
  selectedPaths: ReadonlySet<string>;
  onChange: (selection: Set<string>) => void;
  loading?: boolean;
  error?: string;
  translations?: ExportCenterFeatureTranslations['extras'];
}) {
  const t = translations ?? EXPORT_SCOPE_TRANSLATIONS.en.exportCenter.extras;
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

  const toggleFile = (path: string) => onChange(setFilteredSelection(selectedPaths, [path], !selectedPaths.has(path)));

  return (
    <section className="export-extra-files" aria-label={t.title}>
      <div className="export-extra-files__heading">
        <div><strong>{t.title}</strong><small>{t.description}</small></div>
        <span>{formatFeatureText(t.selectedCount, { count: selectedPaths.size })}</span>
      </div>
      <div className="export-multi-select__toolbar">
        <label className="export-multi-select__search">
          <SearchIcon size={12} />
          <input type="search" value={query} aria-label={t.search} placeholder={t.search} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="export-multi-select__bulk">
          <button type="button" onClick={() => setVisible(true)} disabled={loading}>{t.selectAll}</button>
          <button type="button" onClick={() => setVisible(false)} disabled={loading}>{t.unselectAll}</button>
        </div>
      </div>
      <div className="export-extra-files__rows">
        {loading && <div className="export-multi-select__empty">{t.loading}</div>}
        {!loading && error && <div className="export-multi-select__empty is-error">{error}</div>}
        {!loading && !error && filteredFolders.map((folder) => {
          const paths = folderFiles(folder);
          const checked = paths.length > 0 && paths.every((path) => selectedPaths.has(path));
          return (
            <div className="export-multi-select__row is-folder" key={`folder:${folder}`}>
              <div className="export-multi-select__identity"><span>{folder}</span><small>{formatFeatureText(t.fileCount, { count: paths.length })}</small></div>
              <SwitchButton checked={checked} label={formatFeatureText(t.includeFolder, { path: folder })} onClick={() => toggleFolder(folder)} />
            </div>
          );
        })}
        {!loading && !error && filteredFiles.map((resource) => (
          <div className="export-multi-select__row" key={resource.relativePath}>
            <div className="export-multi-select__identity"><span>{resource.relativePath}</span><small>{formatFeatureText(t.bytes, { count: resource.size.toLocaleString() })}</small></div>
            <SwitchButton checked={selectedPaths.has(resource.relativePath)} label={formatFeatureText(t.includeFile, { path: resource.relativePath })} onClick={() => toggleFile(resource.relativePath)} />
          </div>
        ))}
        {!loading && !error && filteredFolders.length === 0 && filteredFiles.length === 0 && <div className="export-multi-select__empty">{t.noMatches}</div>}
      </div>
    </section>
  );
}
