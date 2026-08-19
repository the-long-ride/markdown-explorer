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
import { exportPdfViaHost, PDF_FOOTER_TEXT } from '../../export/pdfExport';
import { createStoreZip } from '../../export/zipStore';
import type { MdFile } from '../../types/files';
import { TooltipButton } from '../shared/TooltipButton';

interface ExportCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportResult = {
  path: string;
  status: 'success' | 'error';
  message?: string;
};

const encoder = new TextEncoder();

function htmlBlob(html: string): Blob {
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

function zipBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes], { type: 'application/zip' });
}

function pagesFromSnapshots(snapshots: readonly DocumentSnapshot[]): ExportPage[] {
  return snapshots.map((snapshot) => ({ file: snapshot.file, html: snapshot.html }));
}

function buildSiteIndex(files: readonly MdFile[], title: string, themeCss: string): string {
  const safeTitle = escapeExportHtml(title);
  const links = files
    .map((file) => `<li><a href="${escapeExportHtml(exportHtmlPath(file))}">${escapeExportHtml(file.relativePath)}</a></li>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>${themeCss}</style></head><body><main class="mdn-body mdn-export-page"><h1>${safeTitle}</h1><ul>${links}</ul></main></body></html>`;
}

export function ExportCenterModal({ isOpen, onClose }: ExportCenterModalProps) {
  const { state } = useAppState();
  const bridge = usePlatform();
  const [sourceMode, setSourceMode] = useState<ExportSourceMode>('current');
  const [format, setFormat] = useState<ExportFormat>('html');
  const [layout, setLayout] = useState<ExportLayout>('document');
  const [batchMode, setBatchMode] = useState<ExportBatchMode>('separate');
  const [pdfFooterEnabled, setPdfFooterEnabled] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const folders = useMemo(() => folderOptions(state.fileList), [state.fileList]);
  const [folder, setFolder] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ExportResult[]>([]);
  const [summary, setSummary] = useState('');
  const exportGeneration = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const current = state.fileList.find((file) => file.fsPath === state.currentFile);
    setSourceMode(current ? 'current' : 'selected');
    setFormat('html');
    setLayout('document');
    setBatchMode('separate');
    setPdfFooterEnabled(true);
    setSelectedPaths(new Set(current ? [current.fsPath] : []));
    setFolder(folders[0] || '');
    setRunning(false);
    setResults([]);
    setSummary('');
  }, [folders, isOpen, state.currentFile, state.fileList]);

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
      : selectedFiles;

  const toggleSelected = (path: string) => {
    setSelectedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const runExport = async () => {
    setSummary('');
    setResults([]);
    let job;
    try {
      job = buildExportJob({ format, layout, batchMode, files: sourceFiles });
    } catch (error) {
      setSummary(error instanceof Error ? error.message : 'Unable to create export job');
      return;
    }

    const generation = ++exportGeneration.current;
    const isCurrentGeneration = () => generation === exportGeneration.current;
    const nextResults: ExportResult[] = [];
    setRunning(true);

    try {
      const snapshotResults = await Promise.allSettled(
        job.files.map((file) => loadDocumentSnapshot(bridge, file, state.settings)),
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

      const portableSnapshots = await Promise.all(
        snapshots.map(async (snapshot) => ({
          ...snapshot,
          html: await embedExportLocalAssets(snapshot.html, snapshot.file.fsPath),
        })),
      );
      const themeCss = captureExportThemeCss();
      const baseName = safeBaseName(state.workspaceName || portableSnapshots[0].file.title || 'export');
      const pages = pagesFromSnapshots(portableSnapshots);

      if (job.format === 'html') {
        if (job.batchMode === 'merged') {
          const html = buildStandaloneExportHtml({ pages, layout: job.layout, title: state.workspaceName || 'Markdown Explorer Export', themeCss });
          const fileName = `${baseName}-merged.html`;
          const ok = await saveBlobAsFile(htmlBlob(html), fileName);
          if (!ok) throw new Error('The HTML file could not be saved.');
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
          const ok = await saveBlobAsFile(htmlBlob(html), fileName);
          if (!ok) throw new Error('The HTML file could not be saved.');
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
          const ok = await saveBlobAsFile(zipBlob(createStoreZip(entries)), fileName);
          if (!ok) throw new Error('The HTML archive could not be saved.');
          entries.forEach((entry) => nextResults.push({ path: entry.path, status: 'success' }));
        }
      } else if (job.format === 'site') {
        const exportedFiles = portableSnapshots.map((item) => item.file);
        const entries: { path: string; data: Uint8Array }[] = [];
        if (job.batchMode === 'merged') {
          entries.push({
            path: 'index.html',
            data: encoder.encode(buildStandaloneExportHtml({
              pages,
              layout: job.layout,
              title: state.workspaceName || 'Markdown Explorer Export',
              themeCss,
            })),
          });
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
        const ok = await saveBlobAsFile(zipBlob(createStoreZip(entries)), fileName);
        if (!ok) throw new Error('The static website archive could not be saved.');
        entries.forEach((entry) => nextResults.push({ path: entry.path, status: 'success' }));
      } else {
        if (state.appRuntime !== 'desktop') {
          throw new Error('Direct PDF export is currently available in the Markdown Explorer desktop runtime.');
        }

        const documents = job.batchMode === 'merged'
          ? [{
              fileName: `${baseName}-merged.pdf`,
              html: buildStandaloneExportHtml({
                pages,
                layout: job.layout,
                title: state.workspaceName || 'Markdown Explorer Export',
                themeCss,
              }),
            }]
          : portableSnapshots.map((snapshot) => ({
              fileName: pdfOutputName(snapshot.file, portableSnapshots.length > 1),
              html: buildStandaloneExportHtml({
                pages: [{ file: snapshot.file, html: snapshot.html }],
                layout: job.layout,
                title: snapshot.file.title,
                themeCss,
              }),
            }));

        const pdfResult = await exportPdfViaHost(bridge, { documents, footerEnabled: pdfFooterEnabled });
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
    <div
      className="mdn-modal export-center"
      role="dialog"
      aria-modal="true"
      aria-label="Export Center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="export-center__card">
        <header className="export-center__header">
          <div className="export-center__heading">
            <h2>Export Center</h2>
            <p>Export documents with the current Markdown Explorer theme and layout.</p>
          </div>
          <TooltipButton
            className="export-center__close"
            type="button"
            onClick={onClose}
            tooltip="Close Export Center"
            shortcut="Esc"
            tooltipPos="below"
            tooltipAlign="right"
          >
            &times;
          </TooltipButton>
        </header>

        <div className="export-center__body">
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
                {state.fileList.map((file) => (
                  <label key={file.fsPath} className="export-center__file-row">
                    <input type="checkbox" checked={selectedPaths.has(file.fsPath)} onChange={() => toggleSelected(file.fsPath)} />
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
                <span>{folderFiles.length} document{folderFiles.length === 1 ? '' : 's'}</span>
              </div>
            )}
          </section>

          <section className="export-center__options">
            <fieldset aria-label="Format">
              <legend>Format</legend>
              <div className="export-center__cards export-center__cards--format">
                <label className={format === 'html' ? 'is-selected' : ''}><input type="radio" name="export-format" value="html" checked={format === 'html'} onChange={() => setFormat('html')} /> <strong>HTML</strong><span>Standalone themed document</span></label>
                <label className={format === 'pdf' ? 'is-selected' : ''}><input type="radio" name="export-format" value="pdf" checked={format === 'pdf'} onChange={() => setFormat('pdf')} /> <strong>PDF</strong><span>Direct themed PDF export</span></label>
                <label className={format === 'site' ? 'is-selected' : ''}><input type="radio" name="export-format" value="site" checked={format === 'site'} onChange={() => setFormat('site')} /> <strong>Static Website</strong><span>Portable site ZIP with internal links</span></label>
              </div>
            </fieldset>

            <fieldset aria-label="Visual layout">
              <legend>Visual Layout</legend>
              <div className="export-center__cards">
                <label className={layout === 'document' ? 'is-selected' : ''}><input type="radio" name="export-layout" checked={layout === 'document'} onChange={() => setLayout('document')} /> <strong>Document only</strong><span>Theme, typography, diagrams and content without app chrome</span></label>
                <label className={layout === 'explorer' ? 'is-selected' : ''}><input type="radio" name="export-layout" checked={layout === 'explorer'} onChange={() => setLayout('explorer')} /> <strong>Full Explorer layout</strong><span>Export-safe topbar, document navigation and TOC shell</span></label>
              </div>
            </fieldset>

            <fieldset aria-label="Batch mode">
              <legend>Batch Output</legend>
              <div className="export-center__choice-row">
                <label><input type="radio" name="export-batch" checked={batchMode === 'separate'} onChange={() => setBatchMode('separate')} /> Separate outputs</label>
                <label><input type="radio" name="export-batch" checked={batchMode === 'merged'} onChange={() => setBatchMode('merged')} /> Merged output</label>
              </div>
            </fieldset>

            {format === 'pdf' && (
              <div className="export-center__pdf-options">
                <span>Choose an output folder when you export. Markdown Explorer writes the PDF files directly.</span>
                <label className="export-center__footer-toggle">
                  <input
                    type="checkbox"
                    checked={pdfFooterEnabled}
                    onChange={(event) => setPdfFooterEnabled(event.target.checked)}
                    aria-label="Include PDF footer"
                  />
                  <span>Include footer</span>
                  <small>{PDF_FOOTER_TEXT}</small>
                </label>
              </div>
            )}

            <div className="export-center__selection-summary">{sourceFiles.length} document{sourceFiles.length === 1 ? '' : 's'} selected</div>

            {(summary || results.length > 0) && (
              <div className="export-center__results" aria-live="polite">
                {summary && <strong>{summary}</strong>}
                {results.length > 0 && (
                  <ul>
                    {results.map((result, index) => (
                      <li key={`${result.path}-${index}`} className={`is-${result.status}`}>
                        <span>{result.path}</span>{result.message && <small>{result.message}</small>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
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
