import type { Dispatch, SetStateAction } from 'react';
import type { ExportSourceMode } from '../../export/exportModel';
import type { MdFile } from '../../types/files';

interface ExportCenterSourcePanelProps {
  sourceMode: ExportSourceMode;
  setSourceMode: Dispatch<SetStateAction<ExportSourceMode>>;
  currentFile: MdFile | null;
  files: readonly MdFile[];
  selectedPaths: ReadonlySet<string>;
  onToggleSelected: (path: string) => void;
  folders: readonly string[];
  folder: string;
  setFolder: Dispatch<SetStateAction<string>>;
  folderFileCount: number;
}

export function ExportCenterSourcePanel({
  sourceMode,
  setSourceMode,
  currentFile,
  files,
  selectedPaths,
  onToggleSelected,
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
      </div>

      {sourceMode === 'current' && (
        <div className="export-center__current-file">{currentFile?.relativePath || 'No current document'}</div>
      )}

      {sourceMode === 'selected' && (
        <div className="export-center__file-list">
          {files.map((file) => (
            <label key={file.fsPath} className="export-center__file-row">
              <input type="checkbox" checked={selectedPaths.has(file.fsPath)} onChange={() => onToggleSelected(file.fsPath)} />
              <span>{file.relativePath}</span>
            </label>
          ))}
        </div>
      )}

      {sourceMode === 'folder' && (
        <div className="export-center__folder-picker">
          <label htmlFor="export-center-folder">Folder to export</label>
          <select id="export-center-folder" value={folder} onChange={(event) => setFolder(event.target.value)}>
            {folders.map((path) => <option key={path} value={path}>{path}</option>)}
          </select>
          <span>{folderFileCount} document{folderFileCount === 1 ? '' : 's'}</span>
        </div>
      )}
    </section>
  );
}
