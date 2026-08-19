import type { Dispatch, SetStateAction } from 'react';
import type { ExportBatchMode, ExportFormat, ExportLayout } from '../../export/exportModel';

export interface ExportActivityResult {
  path: string;
  status: 'success' | 'error';
  message?: string;
}

export function ExportCenterOptionsPanel({
  format,
  setFormat,
  layout,
  setLayout,
  batchMode,
  setBatchMode,
  selectedCount,
  extraCount,
  summary,
  results,
}: {
  format: ExportFormat;
  setFormat: Dispatch<SetStateAction<ExportFormat>>;
  layout: ExportLayout;
  setLayout: Dispatch<SetStateAction<ExportLayout>>;
  batchMode: ExportBatchMode;
  setBatchMode: Dispatch<SetStateAction<ExportBatchMode>>;
  selectedCount: number;
  extraCount: number;
  summary: string;
  results: readonly ExportActivityResult[];
}) {
  const artifactLabel = format === 'html'
    ? (extraCount > 0 ? 'HTML package (.zip)' : 'HTML (.html)')
    : format === 'site'
      ? 'Static Website (.zip)'
      : batchMode === 'separate' && selectedCount > 1 ? 'PDF files' : 'PDF (.pdf)';

  return (
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

      <div className="export-center__selection-summary">
        <span>{selectedCount} document{selectedCount === 1 ? '' : 's'} selected</span>
        <strong>{artifactLabel}</strong>
      </div>

      <div className="export-center__activity" aria-live="polite">
        <div className="export-center__activity-heading"><strong>Export activity</strong></div>
        {!summary && results.length === 0 && <div className="export-center__activity-empty">Export progress and saved outputs will appear here.</div>}
        {summary && <div className="export-center__activity-summary">{summary}</div>}
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
    </section>
  );
}
