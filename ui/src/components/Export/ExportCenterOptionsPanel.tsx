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
  t: ExportCenterFeatureTranslations['options'];
}) {
  if (args.format === 'site') return args.t.artifactSite;
  if (args.format === 'pdf') return args.batchMode === 'separate' && args.selectedCount > 1 ? args.t.artifactPdfFiles : args.t.artifactPdf;
  return args.batchMode === 'separate' && args.selectedCount > 1 ? args.t.artifactHtmlPackage : args.t.artifactHtml;
}

interface ExportSegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

function ExportSegmentedGroup<T extends string>({
  legend,
  groupLabel,
  value,
  options,
  onChange,
  description,
  descriptionId,
}: {
  legend: string;
  groupLabel: string;
  value: T;
  options: readonly ExportSegmentedOption<T>[];
  onChange: (value: T) => void;
  description?: string;
  descriptionId?: string;
}) {
  return (
    <fieldset aria-label={legend}>
      <legend>{legend}</legend>
      <div
        className={`segmented-control${options.length === 2 ? ' segmented-control--two' : ''} export-center__segmented`}
        role="radiogroup"
        aria-label={groupLabel}
        aria-describedby={description && descriptionId ? descriptionId : undefined}
      >
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              data-value={option.value}
              disabled={option.disabled}
              className={`segmented-option${active ? ' is-active' : ''}`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {description && descriptionId && (
        <p id={descriptionId} className="export-center__option-desc">{description}</p>
      )}
    </fieldset>
  );
}

export function ExportCenterOptionsPanel({
  format, setFormat, layout, setLayout, batchMode, setBatchMode,
  selectedCount, summary, results, translations,
}: {
  format: ExportFormat;
  setFormat: Dispatch<SetStateAction<ExportFormat>>;
  layout: ExportLayout;
  setLayout: Dispatch<SetStateAction<ExportLayout>>;
  batchMode: ExportBatchMode;
  setBatchMode: Dispatch<SetStateAction<ExportBatchMode>>;
  selectedCount: number;
  summary: string;
  results: readonly ExportActivityResult[];
  translations?: ExportCenterFeatureTranslations['options'];
}) {
  const t = translations ?? EXPORT_SCOPE_TRANSLATIONS.en.exportCenter.options;
  const outputLabel = artifactLabel({ format, batchMode, selectedCount, t });
  const explorerDisabled = format === 'pdf';
  const formatDescription = format === 'html'
    ? t.htmlDescription
    : format === 'pdf'
      ? t.pdfDescription
      : t.staticWebsiteDescription;
  const layoutDescription = layout === 'document' ? t.documentOnlyDescription : t.fullExplorerLayoutDescription;

  return (
    <section className="export-center__options">
      <ExportSegmentedGroup
        legend={t.format}
        groupLabel={t.format}
        value={format}
        onChange={setFormat}
        description={formatDescription}
        descriptionId="export-format-description"
        options={[
          { value: 'html', label: 'HTML' },
          { value: 'pdf', label: 'PDF' },
          { value: 'site', label: t.staticWebsite },
        ]}
      />
      <ExportSegmentedGroup
        legend={t.visualLayout}
        groupLabel={t.visualLayout}
        value={layout}
        onChange={setLayout}
        description={layoutDescription}
        descriptionId="export-layout-description"
        options={[
          { value: 'document', label: t.documentOnly },
          { value: 'explorer', label: t.fullExplorerLayout, disabled: explorerDisabled },
        ]}
      />
      <ExportSegmentedGroup
        legend={t.batchOutput}
        groupLabel={t.batchMode}
        value={batchMode}
        onChange={setBatchMode}
        options={[
          { value: 'separate', label: t.separateOutputs },
          { value: 'merged', label: t.mergedOutput },
        ]}
      />
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
