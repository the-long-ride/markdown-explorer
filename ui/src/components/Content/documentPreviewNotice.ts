import type { Translations } from "../../contexts/translations";

export function formatPreviewDuration(durationMs: number | undefined): string {
  if (!Number.isFinite(durationMs) || !durationMs) return "";
  if (durationMs < 1000) return `${Math.max(1, Math.round(durationMs))} ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
}

const DEFAULT_CONVERSION_WARNING = "This preview was converted to Markdown. Layout, images, tables, and styling may not perfectly match the original file.";
const DEFAULT_CONVERSION_FAILURE_WARNING = "Markdown Explorer could not convert this file. The details are shown below.";

export function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.split(`{${key}}`).join(value), template);
}

export interface PreviewNotice {
  kind: string;
  title: string;
  warning: string;
  meta: string;
}

interface PreviewInfoLike {
  kind: string;
  sourceLabel: string;
  durationMs?: number;
  fromCache?: boolean;
  qualityCode?: string;
  qualityWarning?: string;
}

export function buildPreviewNotice(previewInfo: PreviewInfoLike | null | undefined, t: Translations): PreviewNotice | null {
  if (!previewInfo) return null;
  const previewCopy = t.documentPreview;
  const previewDuration = formatPreviewDuration(previewInfo.durationMs);
  const title = formatTemplate(previewInfo.kind === "converted" ? previewCopy.convertedTitle : previewCopy.textTitle, { sourceLabel: previewInfo.sourceLabel });
  const warning = previewInfo.qualityCode === "conversion-failed" || previewInfo.qualityWarning === DEFAULT_CONVERSION_FAILURE_WARNING
    ? previewCopy.conversionFailedWarning
    : previewInfo.qualityCode === "legacy-best-effort" ? previewCopy.legacyBestEffortWarning
      : previewInfo.qualityCode === "converted-preview" ? previewCopy.convertedWarning
        : previewInfo.qualityWarning && previewInfo.qualityWarning !== DEFAULT_CONVERSION_WARNING ? previewInfo.qualityWarning
          : previewInfo.kind === "converted" ? previewCopy.convertedWarning : previewCopy.textWarning;
  const meta = previewDuration
    ? formatTemplate(previewCopy.durationMeta, {
        status: previewInfo.fromCache ? previewCopy.loadedCachedConversion : previewCopy.preparedLocally,
        duration: previewDuration,
      })
    : "";
  return { kind: previewInfo.kind, title, warning, meta };
}
