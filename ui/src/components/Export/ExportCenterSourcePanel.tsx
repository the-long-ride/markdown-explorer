import type { Dispatch, SetStateAction } from 'react';
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
}

export function ExportCenterSourcePanel({
  sourceMode,
  setSourceMode,
  currentFile,
  files,
  selectedPaths,
  onSelectedPathsChange,
  folders,
  folder,
  setFolder,
  folderFileCount,
}: ExportCenterSourcePanelProps) {
  return (
    <section className="export-center__sources" aria-label="Export source">
      <h3>Source</h3>
      <div className="export-center__choice-row" role="radiogroup" aria-label="Source mode">
        <label><input type="radio" name="export-source" checked={sourceMode === 'current'} onChange={() => setSourceMode('current')} disabled={!currentFile} /> Current document</label>
        <label><input type="radio" name="export-source" checked={sourceMode === 'selected'} onChange={() => setSourceMode('selected')} /> Selected documents</label>
        <label><input type="radio" name="export-source" checked={sourceMode === 'folder'} onChange={() => setSourceMode('folder')} disabled={folders.length === 0} /> Folder</label>
        <label><input type="radio" name="export-source" checked={sourceMode === 'workspace'} onChange={() => setSourceMode('workspace')} /> Whole workspace</label>
      </div>

      {sourceMode === 'current' && (
        <div className="export-center__current-file">{currentFile?.relativePath || 'No current document'}</div>
      )}

      {sourceMode === 'selected' && (
        <ExportMultiSelect
          ariaLabel="Documents to export"
          items={files.map((file) => ({ id: file.fsPath, label: file.fileName, detail: file.relativePath }))}
          selected={selectedPaths}
          onChange={onSelectedPathsChange}
          searchPlaceholder="Search documents"
        />
      )}

      {sourceMode === 'folder' && (
        <div className="export-center__folder-picker">
          <SearchableSelect
            label="Folder to export"
            value={folder}
            options={folders.map((path) => ({ value: path, label: path }))}
            onChange={setFolder}
            searchPlaceholder="Search folders"
          />
          <span>{folderFileCount} document{folderFileCount === 1 ? '' : 's'}</span>
        </div>
      )}

      {sourceMode === 'workspace' && (
        <div className="export-center__current-file">
          {files.length} renderable document{files.length === 1 ? '' : 's'}
        </div>
      )}
    </section>
  );
}
