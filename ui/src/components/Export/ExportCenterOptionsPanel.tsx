import type { Dispatch, SetStateAction } from 'react';
import { EXPORT_SCOPE_TRANSLATIONS, formatFeatureText, type ExportCenterFeatureTranslations } from '../../contexts/exportScopeTranslations';
import type { ExportBatchMode, ExportFormat, ExportLayout } from '../../export/exportModel';

export interface ExportActivityResult {
  path: string;
  status: 'success' | 'error' | 'warning' | 'progress';
  message?: string;
}

function artifactLabel(args: {
  format: ExportFormat;
  batchMode: ExportBatchMode;
  selectedCount: number;
  extraCount: number;
  t: ExportCenterFeatureTranslations['options'];
}) {
  if (args.format === 'site') return args.t.artifactSite;
  if (args.format === 'pdf') return args.batchMode === 'separate' && args.selectedCount > 1 ? args.t.artifactPdfFiles : args.t.artifactPdf;
  return args.extraCount > 0 || (args.batchMode === 'separate' && args.selectedCount > 1) ? args.t.artifactHtmlPackage : args.t.artifactHtml;
}

export function ExportCenterOptionsPanel({
  format, setFormat, layout, setLayout, batchMode, setBatchMode,
  selectedCount, extraCount, summary, results, translations,
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
  translations?: ExportCenterFeatureTranslations['options'];
}) {
  const t = translations ?? EXPORT_SCOPE_TRANSLATIONS.en.exportCenter.options;
  const outputLabel = artifactLabel({ format, batchMode, selectedCount, extraCount, t });
  return (
    <section className="export-center__options">
      <fieldset aria-label={t.format}>
        <legend>{t.format}</legend>
        <div className="export-center__cards export-center__cards--format">
          <label className={format === 'html' ? 'is-selected' : ''}><input type="radio" name="export-format" value="html" checked={format === 'html'} onChange={() => setFormat('html')} /> <strong>HTML</strong><span>{t.htmlDescription}</span></label>
          <label className={format === 'pdf' ? 'is-selected' : ''}><input type="radio" name="export-format" value="pdf" checked={format === 'pdf'} onChange={() => setFormat('pdf')} /> <strong>PDF</strong><span>{t.pdfDescription}</span></label>
          <label className={format === 'site' ? 'is-selected' : ''}><input type="radio" name="export-format" value="site" checked={format === 'site'} onChange={() => setFormat('site')} /> <strong>{t.staticWebsite}</strong><span>{t.staticWebsiteDescription}</span></label>
        </div>
      </fieldset>
      <fieldset aria-label={t.visualLayout}>
        <legend>{t.visualLayout}</legend>
        <div className="export-center__cards">
          <label className={layout === 'document' ? 'is-selected' : ''}><input type="radio" name="export-layout" checked={layout === 'document'} onChange={() => setLayout('document')} /> <strong>{t.documentOnly}</strong><span>{t.documentOnlyDescription}</span></label>
          <label className={layout === 'explorer' ? 'is-selected' : ''}><input type="radio" name="export-layout" checked={layout === 'explorer'} onChange={() => setLayout('explorer')} /> <strong>{t.fullExplorerLayout}</strong><span>{t.fullExplorerLayoutDescription}</span></label>
        </div>
      </fieldset>
      <fieldset aria-label={t.batchMode}>
        <legend>{t.batchOutput}</legend>
        <div className="export-center__choice-row">
          <label><input type="radio" name="export-batch" checked={batchMode === 'separate'} onChange={() => setBatchMode('separate')} /> {t.separateOutputs}</label>
          <label><input type="radio" name="export-batch" checked={batchMode === 'merged'} onChange={() => setBatchMode('merged')} /> {t.mergedOutput}</label>
        </div>
      </fieldset>
      <div className="export-center__selection-summary"><span>{formatFeatureText(t.documentsSelected, { count: selectedCount })}</span><strong>{outputLabel}</strong></div>
      <div className="export-center__activity" aria-live="polite">
        <div className="export-center__activity-heading"><strong>{t.activity}</strong></div>
        {!summary && results.length === 0 && <div className="export-center__activity-empty">{t.activityEmpty}</div>}
        {summary && <div className="export-center__activity-summary">{summary}</div>}
        {results.length > 0 && <ul>{results.map((item, index) => (
          <li key={`${item.path}-${index}`} className={`is-${item.status}`}><span>{item.path}</span>{item.message && <small>{item.message}</small>}</li>
        ))}</ul>}
      </div>
    </section>
  );
}
