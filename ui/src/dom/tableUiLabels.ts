import { AUDITED_UI_TRANSLATIONS } from '../contexts/auditedUiTranslations.ts';
import type { AuditedUiTranslationDomains } from '../contexts/auditedUiTranslationTypes';

export type TableUiLabels = AuditedUiTranslationDomains['rendererUi'];
export const DEFAULT_TABLE_UI_LABELS: TableUiLabels = AUDITED_UI_TRANSLATIONS.en.rendererUi;

export function formatUiLabel(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    template,
  );
}

export function getTableUiLabels(tableId: string, root: Document = document): TableUiLabels {
  const encoded = root.getElementById(`${tableId}-wrap`)?.dataset.uiLabels;
  if (!encoded) return DEFAULT_TABLE_UI_LABELS;
  try {
    return { ...DEFAULT_TABLE_UI_LABELS, ...JSON.parse(encoded) } as TableUiLabels;
  } catch {
    return DEFAULT_TABLE_UI_LABELS;
  }
}
