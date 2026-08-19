import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
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
import { listWorkspaceExportResources } from '../../export/exportResources';
import type { ExportWorkspaceResourceInfo } from '../../types/hostMessages';
import { TooltipButton } from '../shared/TooltipButton';
import { ExportAdditionalFilesPanel } from './ExportAdditionalFilesPanel';
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
  const [extraResourcePaths, setExtraResourcePaths] = useState<Set<string>>(() => new Set());
  const [resources, setResources] = useState<readonly ExportWorkspaceResourceInfo[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState('');
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
    setExtraResourcePaths(new Set());
    setFolder(folders[0] || '');
    setRunning(false);
    setResults([]);
    setSummary('');
  }, [folders, isOpen, state.currentFile, state.fileList]);

  useEffect(() => {
    if (!isOpen || format === 'pdf') { setResourceLoading(false); setResourceError(''); return; }
    let active = true;
    setResourceLoading(true);
    setResourceError('');
    void listWorkspaceExportResources(bridgeRef.current)
      .then((next) => { if (active) setResources(next); })
      .catch((error) => { if (active) setResourceError(error instanceof Error ? error.message : 'Unable to list workspace files'); })
      .finally(() => { if (active) setResourceLoading(false); });
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
  const sourceFiles = sourceMode === 'current' ? (currentFile ? [currentFile] : [])
    : sourceMode === 'folder' ? folderFiles
      : sourceMode === 'workspace' ? state.fileList : selectedFiles;

  const runExport = async () => {
    setSummary('');
    setResults([]);
    let job;
    try {
      job = buildExportJob({
        format, layout, batchMode, files: sourceFiles,
        extraResourcePaths: format === 'pdf' ? [] : [...extraResourcePaths],
      });
    } catch (error) {
      setSummary(error instanceof Error ? error.message : 'Unable to create export job');
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
        resources,
        isCancelled: () => generation !== exportGeneration.current,
        onEvent: (event) => {
          if (generation !== exportGeneration.current) return;
          setResults((previous) => [...previous, activityResult(event)].slice(-MAX_ACTIVITY_ROWS));
        },
      });
      if (generation !== exportGeneration.current) return;
      if (outcome.cancelled) setSummary('Export cancelled.');
      else if (outcome.failureCount > 0 && outcome.successCount > 0) setSummary(`Export finished with ${outcome.successCount} successful output${outcome.successCount === 1 ? '' : 's'} and ${outcome.failureCount} error${outcome.failureCount === 1 ? '' : 's'}.`);
      else if (outcome.failureCount > 0) setSummary(`Export failed with ${outcome.failureCount} error${outcome.failureCount === 1 ? '' : 's'}.`);
      else setSummary(`Export complete: ${outcome.successCount} output${outcome.successCount === 1 ? '' : 's'}.`);
    } catch (error) {
      if (generation === exportGeneration.current) setSummary(error instanceof Error ? error.message : 'Export failed');
    } finally {
      if (generation === exportGeneration.current) setRunning(false);
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
            <ExportCenterSourcePanel sourceMode={sourceMode} setSourceMode={setSourceMode} currentFile={currentFile} files={state.fileList} selectedPaths={selectedPaths} onSelectedPathsChange={setSelectedPaths} folders={folders} folder={folder} setFolder={setFolder} folderFileCount={folderFiles.length} />
            {format !== 'pdf' && <ExportAdditionalFilesPanel resources={resources} selectedPaths={extraResourcePaths} onChange={setExtraResourcePaths} loading={resourceLoading} error={resourceError} />}
          </div>
          <ExportCenterOptionsPanel format={format} setFormat={setFormat} layout={layout} setLayout={setLayout} batchMode={batchMode} setBatchMode={setBatchMode} selectedCount={sourceFiles.length} extraCount={format === 'pdf' ? 0 : extraResourcePaths.size} summary={summary} results={results} />
        </div>
        <footer className="export-center__footer"><button type="button" className="btn btn--primary" disabled={running || sourceFiles.length === 0} onClick={() => { void runExport(); }}>{running ? 'Exporting…' : 'Export'}</button></footer>
      </section>
    </div>
  );
}
