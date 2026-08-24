import type { Dispatch, SetStateAction } from 'react';
import { EXPORT_SCOPE_TRANSLATIONS, formatFeatureText, type ExportCenterFeatureTranslations } from '../../contexts/exportScopeTranslations';
import type { ExportSourceMode } from '../../export/exportModel';
import type { MdFile } from '../../types/files';
import { SearchableSelect } from '../shared/SearchableSelect';
import { ExportMultiSelect } from './ExportMultiSelect';
import { ExportSourceSelect } from './ExportSourceSelect';

interface ExportCenterSourcePanelProps {
  sourceMode: ExportSourceMode;
  setSourceMode: Dispatch<SetStateAction<ExportSourceMode>> | ((mode: ExportSourceMode) => void);
  currentFile: MdFile | null;
  files: readonly MdFile[];
  selectedPaths: ReadonlySet<string>;
  onSelectedPathsChange: (selection: Set<string>) => void;
  folders: readonly string[];
  folder: string;
  setFolder: Dispatch<SetStateAction<string>> | ((folder: string) => void);
  folderFileCount: number;
  translations?: ExportCenterFeatureTranslations['source'];
}

export function ExportCenterSourcePanel({
  sourceMode, setSourceMode, currentFile, files, selectedPaths, onSelectedPathsChange,
  folders, folder, setFolder, folderFileCount, translations,
}: ExportCenterSourcePanelProps) {
  const t = translations ?? EXPORT_SCOPE_TRANSLATIONS.en.exportCenter.source;
  return (
    <section className="export-center__sources" aria-label={t.region}>
      <h3>{t.title}</h3>
      <ExportSourceSelect
        ariaLabel={t.mode}
        value={sourceMode}
        onChange={(mode) => setSourceMode(mode as ExportSourceMode)}
        options={[
          { value: 'current', label: t.current, disabled: !currentFile },
          { value: 'selected', label: t.selected },
          { value: 'folder', label: t.folder, disabled: folders.length === 0 },
          { value: 'workspace', label: t.workspace },
        ]}
      />

      {sourceMode === 'current' && <div className="export-center__current-file">{currentFile?.relativePath || t.noCurrent}</div>}

      {sourceMode === 'selected' && (
        <ExportMultiSelect
          ariaLabel={t.documentsToExport}
          items={files.map((file) => ({ id: file.fsPath, label: file.fileName, detail: file.relativePath }))}
          selected={selectedPaths}
          onChange={onSelectedPathsChange}
          searchPlaceholder={t.searchDocuments}
          selectAllLabel={t.selectAll}
          unselectAllLabel={t.unselectAll}
          noMatchesLabel={t.noMatches}
          includeLabel={(path) => formatFeatureText(t.includeFile, { path })}
        />
      )}

      {sourceMode === 'folder' && (
        <div className="export-center__folder-picker">
          <SearchableSelect
            label={t.folderToExport}
            value={folder}
            options={folders.map((path) => ({ value: path, label: path }))}
            onChange={setFolder}
            searchPlaceholder={t.searchFolders}
            emptyLabel={t.noMatches}
          />
          <span>{formatFeatureText(t.documentCount, { count: folderFileCount })}</span>
        </div>
      )}

      {sourceMode === 'workspace' && (
        <div className="export-center__current-file">{formatFeatureText(t.renderableCount, { count: files.length })}</div>
      )}
    </section>
  );
}
