import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { saveBlobAsFile } from '../../dom/copyImage';
import { loadDocumentSnapshot, type DocumentSnapshot } from '../../export/documentSnapshot';
import {
  buildStandaloneExportHtml,
  captureExportThemeCss,
  embedExportLocalAssets,
  escapeExportHtml,
  exportHtmlPath,
  rewriteExportLinks,
  type ExportPage,
} from '../../export/exportHtml';
import {
  buildExportJob,
  fileNameFromPath,
  filesInFolder,
  folderOptions,
  pdfOutputName,
  safeBaseName,
  type ExportBatchMode,
  type ExportFormat,
  type ExportLayout,
  type ExportSourceMode,
} from '../../export/exportModel';
import { listWorkspaceExportResources } from '../../export/exportResources';
import { exportPdfViaHost } from '../../export/pdfExport';
import { createStoreZip } from '../../export/zipStore';
import type { ExportWorkspaceResourceInfo } from '../../types/hostMessages';
import type { MdFile } from '../../types/files';
import { TooltipButton } from '../shared/TooltipButton';
import { ExportAdditionalFilesPanel } from './ExportAdditionalFilesPanel';
import { ExportCenterOptionsPanel, type ExportActivityResult } from './ExportCenterOptionsPanel';
import { ExportCenterSourcePanel } from './ExportCenterSourcePanel';

interface ExportCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const encoder = new TextEncoder();
const htmlBlob = (html: string) => new Blob([html], { type: 'text/html;charset=utf-8' });
const zipBlob = (bytes: Uint8Array) => new Blob([bytes], { type: 'application/zip' });
const pagesFromSnapshots = (snapshots: readonly DocumentSnapshot[]): ExportPage[] => snapshots.map((snapshot) => ({ file: snapshot.file, html: snapshot.html }));

function buildSiteIndex(files: readonly MdFile[], title: string, themeCss: string): string {
  const safeTitle = escapeExportHtml(title);
  const links = files.map((file) => `<li><a href="${escapeExportHtml(exportHtmlPath(file))}">${escapeExportHtml(file.relativePath)}</a></li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>${themeCss}</style></head><body><main class="mdn-body mdn-export-page"><h1>${safeTitle}</h1><ul>${links}</ul></main></body></html>`;
}

export function ExportCenterModal({ isOpen, onClose }: ExportCenterModalProps) {
  const { state } = useAppState();
  const bridge = usePlatform();
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const [sourceMode, setSourceMode] = useState<ExportSourceMode>('current');
  const [format, setFormat] = useState<ExportFormat>('html');
  const [layout, setLayout] = useState<ExportLayout>('document');
  const [batchMode, setBatchMode] = useState<ExportBatchMode>('separate');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [extraResourcePaths, setExtraResourcePaths] = useState<Set<string>>(() => new Set());
  const [resources, setResources] = useState<readonly ExportWorkspaceResourceInfo[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState('');
  const folders = useMemo(() => folderOptions(state.fileList), [state.fileList]);
  const [folder, setFolder] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ExportActivityResult[]>([]);
  const [summary, setSummary] = useState('');
  const exportGeneration = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const current = state.fileList.find((file) => file.fsPath === state.currentFile);
    setSourceMode(current ? 'current' : 'selected');
    setFormat('html');
    setLayout('document');
    setBatchMode('separate');
    setSelectedPaths(new Set(current ? [current.fsPath] : []));
    setExtraResourcePaths(new Set());
    setFolder(folders[0] || '');
    setRunning(false);
    setResults([]);
    setSummary('');
  }, [folders, isOpen, state.currentFile, state.fileList]);

  useEffect(() => {
    if (!isOpen || format === 'pdf') {
      setResourceLoading(false);
      setResourceError('');
      return;
    }
    let active = true;
    setResourceLoading(true);
    setResourceError('');
    void listWorkspaceExportResources(bridgeRef.current)
      .then((nextResources) => {
        if (active) setResources(nextResources);
      })
      .catch((error) => {
        if (active) setResourceError(error instanceof Error ? error.message : 'Unable to list workspace files');
      })
      .finally(() => {
        if (active) setResourceLoading(false);
      });
    return () => { active = false; };
  }, [format, isOpen]);

  useEffect(() => {
    if (isOpen) return;
    exportGeneration.current += 1;
    setRunning(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [isOpen, onClose]);

  const currentFile = state.fileList.find((file) => file.fsPath === state.currentFile) ?? null;
  const selectedFiles = state.fileList.filter((file) => selectedPaths.has(file.fsPath));
  const folderFiles = folder ? filesInFolder(state.fileList, folder) : [];
  const sourceFiles = sourceMode === 'current'
    ? (currentFile ? [currentFile] : [])
    : sourceMode === 'folder'
      ? folderFiles
      : sourceMode === 'workspace'
        ? state.fileList
        : selectedFiles;

  const runExport = async () => {
    setSummary('');
    setResults([]);
    let job;
    try {
      job = buildExportJob({
        format,
        layout,
        batchMode,
        files: sourceFiles,
        extraResourcePaths: format === 'pdf' ? [] : [...extraResourcePaths],
      });
    } catch (error) {
      setSummary(error instanceof Error ? error.message : 'Unable to create export job');
      return;
    }

    const generation = ++exportGeneration.current;
    const isCurrentGeneration = () => generation === exportGeneration.current;
    const nextResults: ExportActivityResult[] = [];
    setRunning(true);

    try {
      const snapshotResults = await Promise.allSettled(
        job.files.map((file) => loadDocumentSnapshot(bridgeRef.current, file, state.settings)),
      );
      const snapshots: DocumentSnapshot[] = [];
      snapshotResults.forEach((result, index) => {
        const file = job.files[index];
        if (result.status === 'fulfilled') snapshots.push(result.value);
        else nextResults.push({
          path: file.relativePath,
          status: 'error',
          message: result.reason instanceof Error ? result.reason.message : 'Unable to render document',
        });
      });
      if (job.batchMode === 'merged' && nextResults.length > 0) {
        if (isCurrentGeneration()) setSummary('Merged export stopped because one or more documents could not be rendered.');
        return;
      }
      if (snapshots.length === 0) {
        if (isCurrentGeneration()) setSummary('No documents could be exported.');
        return;
      }

      const portableSnapshots = await Promise.all(snapshots.map(async (snapshot) => ({
        ...snapshot,
        html: await embedExportLocalAssets(snapshot.html, snapshot.file.fsPath),
      })));
      const themeCss = captureExportThemeCss();
      const baseName = safeBaseName(state.workspaceName || portableSnapshots[0].file.title || 'export');
      const pages = pagesFromSnapshots(portableSnapshots);

      if (job.format === 'html') {
        if (job.batchMode === 'merged') {
          const html = buildStandaloneExportHtml({ pages, layout: job.layout, title: state.workspaceName || 'Markdown Explorer Export', themeCss });
          const fileName = `${baseName}-merged.html`;
          if (!await saveBlobAsFile(htmlBlob(html), fileName)) throw new Error('The HTML file could not be saved.');
          nextResults.push({ path: fileName, status: 'success' });
        } else if (portableSnapshots.length === 1) {
          const snapshot = portableSnapshots[0];
          const html = buildStandaloneExportHtml({
            pages: [{ file: snapshot.file, html: rewriteExportLinks(snapshot.html, snapshot.file, portableSnapshots.map((item) => item.file)) }],
            layout: job.layout,
            title: snapshot.file.title,
            themeCss,
          });
          const fileName = `${safeBaseName(snapshot.file.title)}.html`;
          if (!await saveBlobAsFile(htmlBlob(html), fileName)) throw new Error('The HTML file could not be saved.');
          nextResults.push({ path: fileName, status: 'success' });
        } else {
          const exportedFiles = portableSnapshots.map((item) => item.file);
          const entries = portableSnapshots.map((snapshot) => ({
            path: exportHtmlPath(snapshot.file),
            data: encoder.encode(buildStandaloneExportHtml({
              pages: [{ file: snapshot.file, html: rewriteExportLinks(snapshot.html, snapshot.file, exportedFiles) }],
              layout: job.layout,
              title: snapshot.file.title,
              themeCss,
              navigationFiles: exportedFiles,
            })),
          }));
          const fileName = `${baseName}-html.zip`;
          if (!await saveBlobAsFile(zipBlob(createStoreZip(entries)), fileName)) throw new Error('The HTML archive could not be saved.');
          entries.forEach((entry) => nextResults.push({ path: entry.path, status: 'success' }));
        }
      } else if (job.format === 'site') {
        const exportedFiles = portableSnapshots.map((item) => item.file);
        const entries: { path: string; data: Uint8Array }[] = [];
        if (job.batchMode === 'merged') {
          entries.push({ path: 'index.html', data: encoder.encode(buildStandaloneExportHtml({ pages, layout: job.layout, title: state.workspaceName || 'Markdown Explorer Export', themeCss })) });
        } else {
          entries.push({ path: 'index.html', data: encoder.encode(buildSiteIndex(exportedFiles, state.workspaceName || 'Markdown Explorer Export', themeCss)) });
          for (const snapshot of portableSnapshots) {
            entries.push({
              path: exportHtmlPath(snapshot.file),
              data: encoder.encode(buildStandaloneExportHtml({
                pages: [{ file: snapshot.file, html: rewriteExportLinks(snapshot.html, snapshot.file, exportedFiles) }],
                layout: job.layout,
                title: snapshot.file.title,
                themeCss,
                navigationFiles: exportedFiles,
              })),
            });
          }
        }
        const fileName = `${baseName}-site.zip`;
        if (!await saveBlobAsFile(zipBlob(createStoreZip(entries)), fileName)) throw new Error('The static website archive could not be saved.');
        entries.forEach((entry) => nextResults.push({ path: entry.path, status: 'success' }));
      } else {
        if (state.appRuntime !== 'desktop') {
          throw new Error('Direct PDF export is currently available in the Markdown Explorer desktop runtime.');
        }
        const documents = job.batchMode === 'merged'
          ? [{ fileName: `${baseName}-merged.pdf`, html: buildStandaloneExportHtml({ pages, layout: job.layout, title: state.workspaceName || 'Markdown Explorer Export', themeCss }) }]
          : portableSnapshots.map((snapshot) => ({
              fileName: pdfOutputName(snapshot.file, portableSnapshots.length > 1),
              html: buildStandaloneExportHtml({ pages: [{ file: snapshot.file, html: snapshot.html }], layout: job.layout, title: snapshot.file.title, themeCss }),
            }));
        const pdfResult = await exportPdfViaHost(bridgeRef.current, { documents, footerEnabled: false });
        if (pdfResult.cancelled) {
          if (isCurrentGeneration()) setSummary('PDF export cancelled.');
          return;
        }
        if (!pdfResult.ok) throw new Error(pdfResult.error || 'The PDF files could not be saved.');
        pdfResult.paths.forEach((path) => nextResults.push({ path: fileNameFromPath(path), status: 'success' }));
      }

      if (!isCurrentGeneration()) return;
      const successCount = nextResults.filter((result) => result.status === 'success').length;
      const errorCount = nextResults.filter((result) => result.status === 'error').length;
      setSummary(errorCount > 0
        ? `Export finished with ${successCount} successful output${successCount === 1 ? '' : 's'} and ${errorCount} error${errorCount === 1 ? '' : 's'}.`
        : `Export complete: ${successCount} output${successCount === 1 ? '' : 's'}.`);
    } catch (error) {
      nextResults.push({ path: 'Export', status: 'error', message: error instanceof Error ? error.message : 'Export failed' });
      if (isCurrentGeneration()) setSummary(error instanceof Error ? error.message : 'Export failed');
    } finally {
      if (isCurrentGeneration()) {
        setResults(nextResults);
        setRunning(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="mdn-modal export-center" role="dialog" aria-modal="true" aria-label="Export Center" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="export-center__card">
        <header className="export-center__header">
          <div className="export-center__heading"><h2>Export Center</h2><p>Export documents with the current Markdown Explorer theme and layout.</p></div>
          <TooltipButton className="export-center__close" type="button" onClick={onClose} tooltip="Close Export Center" shortcut="Esc" tooltipPos="below" tooltipAlign="right">&times;</TooltipButton>
        </header>
        <div className="export-center__body">
          <div className="export-center__source-column">
            <ExportCenterSourcePanel
              sourceMode={sourceMode}
              setSourceMode={setSourceMode}
              currentFile={currentFile}
              files={state.fileList}
              selectedPaths={selectedPaths}
              onSelectedPathsChange={setSelectedPaths}
              folders={folders}
              folder={folder}
              setFolder={setFolder}
              folderFileCount={folderFiles.length}
            />
            {format !== 'pdf' && (
              <ExportAdditionalFilesPanel
                resources={resources}
                selectedPaths={extraResourcePaths}
                onChange={setExtraResourcePaths}
                loading={resourceLoading}
                error={resourceError}
              />
            )}
          </div>
          <ExportCenterOptionsPanel
            format={format}
            setFormat={setFormat}
            layout={layout}
            setLayout={setLayout}
            batchMode={batchMode}
            setBatchMode={setBatchMode}
            selectedCount={sourceFiles.length}
            extraCount={format === 'pdf' ? 0 : extraResourcePaths.size}
            summary={summary}
            results={results}
          />
        </div>
        <footer className="export-center__footer">
          <button type="button" className="btn btn--primary" disabled={running || sourceFiles.length === 0} onClick={() => { void runExport(); }}>
            {running ? 'Exporting…' : 'Export'}
          </button>
        </footer>
      </section>
    </div>
  );
}
