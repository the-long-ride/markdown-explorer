import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { formatFeatureText, getExportScopeTranslations } from '../../contexts/exportScopeTranslations';
import { usePlatform } from '../../contexts/PlatformContext';
import { runExportJob, type ExportActivityEvent } from '../../export/exportJobRunner';
import {
  buildExportJob,
  filesInFolder,
  folderOptions,
  type ExportBatchMode,
  type ExportFormat,
  type ExportLayout,
  type ExportSourceMode,
} from '../../export/exportModel';
import { TooltipButton } from '../shared/TooltipButton';
import { ExportCenterOptionsPanel, type ExportActivityResult } from './ExportCenterOptionsPanel';
import { ExportCenterSourcePanel } from './ExportCenterSourcePanel';

interface ExportCenterModalProps { isOpen: boolean; onClose: () => void; }
const MAX_ACTIVITY_ROWS = 200;

function activityResult(event: ExportActivityEvent): ExportActivityResult {
  const status = event.stage === 'saved' ? 'success'
    : event.stage === 'failed' ? 'error'
      : event.stage === 'warning' ? 'warning' : 'progress';
  return { path: event.path, status, ...(event.message ? { message: event.message } : {}) };
}

export function ExportCenterModal({ isOpen, onClose }: ExportCenterModalProps) {
  const { state } = useAppState();
  const t = getExportScopeTranslations(state.settings.language).exportCenter;
  const bridge = usePlatform();
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const initializedOpenRef = useRef(false);
  const exportGeneration = useRef(0);
  const [sourceMode, setSourceMode] = useState<ExportSourceMode>('current');
  const [format, setFormat] = useState<ExportFormat>('html');
  const [layout, setLayout] = useState<ExportLayout>('document');
  const [batchMode, setBatchMode] = useState<ExportBatchMode>('separate');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const folders = useMemo(() => folderOptions(state.fileList), [state.fileList]);
  const [folder, setFolder] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ExportActivityResult[]>([]);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (!isOpen) { initializedOpenRef.current = false; return; }
    if (initializedOpenRef.current) return;
    initializedOpenRef.current = true;
    const current = state.fileList.find((file) => file.fsPath === state.currentFile);
    setSourceMode(current ? 'current' : 'selected');
    setFormat('html');
    setLayout('document');
    setBatchMode('separate');
    setSelectedPaths(new Set(current ? [current.fsPath] : []));
    setFolder(folders[0] || '');
    setRunning(false);
    setResults([]);
    setSummary('');
  }, [folders, isOpen, state.currentFile, state.fileList]);

  useEffect(() => {
    if (format === 'pdf' && layout !== 'document') setLayout('document');
  }, [format, layout]);

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
  const sourceFiles = sourceMode === 'current' ? (currentFile ? [currentFile] : [])
    : sourceMode === 'folder' ? folderFiles
      : sourceMode === 'workspace' ? state.fileList : selectedFiles;

  const runExport = async () => {
    setSummary('');
    setResults([]);
    let job;
    try {
      job = buildExportJob({ format, layout, batchMode, files: sourceFiles });
    } catch (error) {
      const message = error instanceof Error && error.message === 'Select at least one document'
        ? t.status.selectAtLeastOne : t.status.unableCreate;
      setSummary(message);
      return;
    }
    const generation = ++exportGeneration.current;
    setRunning(true);
    try {
      const outcome = await runExportJob({
        bridge: bridgeRef.current,
        runtime: state.appRuntime,
        settings: state.settings,
        workspaceName: state.workspaceName,
        job,
        isCancelled: () => generation !== exportGeneration.current,
        onEvent: (event) => {
          if (generation !== exportGeneration.current) return;
          setResults((previous) => [...previous, activityResult(event)].slice(-MAX_ACTIVITY_ROWS));
        },
      });
      if (generation !== exportGeneration.current) return;
      if (outcome.cancelled) setSummary(t.status.cancelled);
      else if (outcome.failureCount > 0 && outcome.successCount > 0) setSummary(formatFeatureText(t.status.partial, { success: outcome.successCount, failure: outcome.failureCount }));
      else if (outcome.failureCount > 0) setSummary(formatFeatureText(t.status.failedCount, { count: outcome.failureCount }));
      else setSummary(formatFeatureText(t.status.complete, { count: outcome.successCount }));
    } catch (error) {
      if (generation === exportGeneration.current) setSummary(error instanceof Error ? error.message : t.status.failed);
    } finally {
      if (generation === exportGeneration.current) setRunning(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="mdn-modal mdn-app-modal-region export-center" role="dialog" aria-modal="true" aria-label={t.title} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="export-center__card">
        <header className="export-center__header">
          <div className="export-center__heading"><h2>{t.title}</h2><p>{t.description}</p></div>
          <TooltipButton className="export-center__close" type="button" onClick={onClose} tooltip={t.close} shortcut="Esc" tooltipPos="below" tooltipAlign="right">&times;</TooltipButton>
        </header>
        <div className="export-center__body">
          <div className="export-center__source-column">
            <ExportCenterSourcePanel sourceMode={sourceMode} setSourceMode={setSourceMode} currentFile={currentFile} files={state.fileList} selectedPaths={selectedPaths} onSelectedPathsChange={setSelectedPaths} folders={folders} folder={folder} setFolder={setFolder} folderFileCount={folderFiles.length} translations={t.source} />
          </div>
          <ExportCenterOptionsPanel format={format} setFormat={setFormat} layout={layout} setLayout={setLayout} batchMode={batchMode} setBatchMode={setBatchMode} selectedCount={sourceFiles.length} summary={summary} results={results} translations={t.options} />
        </div>
        <footer className="export-center__footer"><button type="button" className="btn btn--primary" disabled={running || sourceFiles.length === 0} onClick={() => { void runExport(); }}>{running ? t.exporting : t.export}</button></footer>
      </section>
    </div>
  );
}
