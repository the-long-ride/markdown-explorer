import type { Dispatch, SetStateAction } from 'react';
import { EXPORT_SCOPE_TRANSLATIONS, formatFeatureText, type ExportCenterFeatureTranslations } from '../../contexts/exportScopeTranslations';
import type { ExportSourceMode } from '../../export/exportModel';
import type { MdFile } from '../../types/files';
import { SearchableSelect } from '../shared/SearchableSelect';
import { ExportMultiSelect } from './ExportMultiSelect';

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
  commonTranslations?: ExportCenterFeatureTranslations['extras'];
}

export function ExportCenterSourcePanel({
  sourceMode, setSourceMode, currentFile, files, selectedPaths, onSelectedPathsChange,
  folders, folder, setFolder, folderFileCount, translations, commonTranslations,
}: ExportCenterSourcePanelProps) {
  const t = translations ?? EXPORT_SCOPE_TRANSLATIONS.en.exportCenter.source;
  const common = commonTranslations ?? EXPORT_SCOPE_TRANSLATIONS.en.exportCenter.extras;
  return (
    <section className="export-center__sources" aria-label={t.region}>
      <h3>{t.title}</h3>
      <div className="export-center__choice-row" role="radiogroup" aria-label={t.mode}>
        <label><input type="radio" name="export-source" checked={sourceMode === 'current'} onChange={() => setSourceMode('current')} disabled={!currentFile} /> {t.current}</label>
        <label><input type="radio" name="export-source" checked={sourceMode === 'selected'} onChange={() => setSourceMode('selected')} /> {t.selected}</label>
        <label><input type="radio" name="export-source" checked={sourceMode === 'folder'} onChange={() => setSourceMode('folder')} disabled={folders.length === 0} /> {t.folder}</label>
        <label><input type="radio" name="export-source" checked={sourceMode === 'workspace'} onChange={() => setSourceMode('workspace')} /> {t.workspace}</label>
      </div>

      {sourceMode === 'current' && <div className="export-center__current-file">{currentFile?.relativePath || t.noCurrent}</div>}

      {sourceMode === 'selected' && (
        <ExportMultiSelect
          ariaLabel={t.documentsToExport}
          items={files.map((file) => ({ id: file.fsPath, label: file.fileName, detail: file.relativePath }))}
          selected={selectedPaths}
          onChange={onSelectedPathsChange}
          searchPlaceholder={t.searchDocuments}
          selectAllLabel={common.selectAll}
          unselectAllLabel={common.unselectAll}
          noMatchesLabel={common.noMatches}
          includeLabel={(path) => formatFeatureText(common.includeFile, { path })}
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
            emptyLabel={common.noMatches}
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
