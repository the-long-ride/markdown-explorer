import * as base from './settingsImportExportBase';
import { normalizeInsightsSettingsExport, type InsightsSettingsExportConfig } from '../insights/config';
import { loadInsightsSettingsConfig } from '../insights/settingsStore';
import { migrateDesktopFontBindings } from '../desktop/fonts/fontModel';

export * from './settingsImportExportBase';

export interface SettingsExportEnvelope extends Omit<base.SettingsExportEnvelope, 'payload'> {
  readonly payload: base.SettingsExportEnvelope['payload'] & {
    readonly insights: InsightsSettingsExportConfig;
  };
}

export interface ImportedSettingsPayload extends base.ImportedSettingsPayload {
  readonly insights?: InsightsSettingsExportConfig;
}

export function createSettingsExport(
  params: Parameters<typeof base.createSettingsExport>[0] & { readonly insights?: unknown },
): SettingsExportEnvelope {
  const envelope = base.createSettingsExport(params);
  const insights = params.insights === undefined
    ? loadInsightsSettingsConfig()
    : normalizeInsightsSettingsExport(params.insights);
  return {
    ...envelope,
    payload: {
      ...envelope.payload,
      insights,
    },
  };
}

export function parseSettingsImport(rawText: string, isDesktop: boolean): ImportedSettingsPayload {
  const imported = base.parseSettingsImport(rawText, isDesktop);
  const parsed = JSON.parse(rawText) as { readonly payload?: { readonly insights?: unknown; readonly settings?: unknown } };
  const raw = parsed.payload?.settings && typeof parsed.payload.settings === 'object'
    ? parsed.payload.settings as Record<string, unknown>
    : {};
  const hasInsights = parsed.payload !== undefined
    && Object.prototype.hasOwnProperty.call(parsed.payload, 'insights');
  return {
    ...imported,
    settings: {
      ...imported.settings,
      bookmarksEnabled: raw.bookmarksEnabled === true,
      insightsEnabled: raw.insightsEnabled === true,
      defaultCsvPreview: raw.defaultCsvPreview !== false,
      defaultHtmlCodeBlockPreview: typeof raw.defaultHtmlCodeBlockPreview === 'boolean'
        ? raw.defaultHtmlCodeBlockPreview
        : raw.defaultHtmlPreview !== false,
      sidebarPinnedItems: base.normalizeSidebarPinnedItems(raw.sidebarPinnedItems, imported.settings.maxPinnedItems),
      sidebarSortModes: base.normalizeSidebarSortModes(raw.sidebarSortModes),
      fontBindings: migrateDesktopFontBindings(raw.fontBindings, raw.appFont, raw.codeFont),
    },
    insights: hasInsights ? normalizeInsightsSettingsExport(parsed.payload?.insights) : undefined,
  };
}
