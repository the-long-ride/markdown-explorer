import {
  DESKTOP_TABS_STORAGE_KEY,
  SETTINGS_EXPORT_KIND,
  SETTINGS_EXPORT_SCHEMA_VERSION,
  SIDEBAR_WIDTH_STORAGE_KEY,
  TOC_WIDTH_STORAGE_KEY,
  WORKSPACE_ALIASES_STORAGE_KEY,
} from '../constants/storage';
import {
  IMPORTED_KEYBINDING_MAX_LENGTH,
  IMPORTED_LANGUAGE_MAX_LENGTH,
  IMPORTED_LOCAL_UI_MAX_SERIALIZED_LENGTH,
  RECENT_WORKSPACES_MAX_COUNT,
  RECENT_WORKSPACE_NAME_MAX_LENGTH,
  SCOPE_PATH_MAX_LENGTH,
  SCOPE_PATHS_MAX_COUNT,
  SCOPE_WORKSPACE_KEY_MAX_LENGTH,
} from '../constants/limits';
import {
  normalizeDesktopViewMode,
  normalizeKeybindings,
  normalizeThemeMode,
  normalizeThemeStyle,
} from '../contexts/appStateConstants';
import { normalizeActiveCustomThemeId, normalizeCustomThemes } from '../theme/customThemes';
import type {
  AppSettings,
  CustomTheme,
  RecentWorkspace,
  ThemeMode,
  ThemeStyle,
} from '../types';

export { SETTINGS_EXPORT_KIND, SETTINGS_EXPORT_SCHEMA_VERSION } from '../constants/storage';

export type SettingsImportErrorCode = 'invalidJson' | 'missingData' | 'wrongFile' | 'unknownSchema';

export class SettingsImportError extends Error {
  readonly code: SettingsImportErrorCode;

  constructor(code: SettingsImportErrorCode, message: string) {
    super(message);
    this.name = 'SettingsImportError';
    this.code = code;
  }
}

export interface SettingsExportEnvelope {
  readonly kind: typeof SETTINGS_EXPORT_KIND;
  readonly schemaVersion: number;
  readonly appVersion?: string;
  readonly exportedAt: string;
  readonly payload: {
    readonly theme: ThemeMode;
    readonly themeStyle: ThemeStyle;
    readonly settings: AppSettings;
    readonly recentWorkspaces: readonly RecentWorkspace[];
    readonly localUi: {
      readonly sidebarWidth?: string;
      readonly tocWidth?: string;
      readonly workspaceAliases?: unknown;
      readonly desktopTabs?: unknown;
    };
  };
}

export interface ImportedSettingsPayload {
  readonly theme: ThemeMode;
  readonly themeStyle: ThemeStyle;
  readonly settings: AppSettings;
  readonly recentWorkspaces: RecentWorkspace[];
  readonly localUi: SettingsExportEnvelope['payload']['localUi'];
}

function readLocalStorageJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function normalizeStorageNumber(value: string | null): string | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(Math.round(parsed)) : undefined;
}

function writeJsonStorage(
  key: string,
  value: unknown,
  maxLength = IMPORTED_LOCAL_UI_MAX_SERIALIZED_LENGTH,
) {
  if (!value || typeof value !== 'object') return;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > maxLength) return;
    localStorage.setItem(key, serialized);
  } catch {
    // Ignore invalid imported local UI fragments.
  }
}

export function normalizeRecentWorkspaces(value: unknown): RecentWorkspace[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    const path = typeof raw.path === 'string' ? raw.path.trim() : '';
    if (!path || seen.has(path)) return [];
    seen.add(path);
    const pathParts = path.split(/[\\/]/).filter(Boolean);
    const name = typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim().slice(0, RECENT_WORKSPACE_NAME_MAX_LENGTH)
      : pathParts[pathParts.length - 1] ?? path;
    const lastOpened = Number(raw.lastOpened);
    return [{
      name,
      path,
      lastOpened: Number.isFinite(lastOpened) ? lastOpened : Date.now(),
    }];
  }).slice(0, RECENT_WORKSPACES_MAX_COUNT);
}

function normalizeKeybindingsForImport(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entries = Object.entries(value as Record<string, unknown>).flatMap(([key, shortcut]) => {
    if (typeof key !== 'string' || typeof shortcut !== 'string') return [];
    const normalizedShortcut = shortcut.trim().slice(0, IMPORTED_KEYBINDING_MAX_LENGTH);
    return normalizedShortcut ? [[key, normalizedShortcut] as const] : [];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeScopeFocus(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).flatMap(([workspaceKey, paths]) => {
    if (typeof workspaceKey !== 'string' || !workspaceKey.trim() || !Array.isArray(paths)) return [];
    const seen = new Set<string>();
    const normalizedPaths = paths.flatMap((path) => {
      if (typeof path !== 'string') return [];
      const normalizedPath = path.trim().slice(0, SCOPE_PATH_MAX_LENGTH);
      if (!normalizedPath || seen.has(normalizedPath)) return [];
      seen.add(normalizedPath);
      return [normalizedPath];
    }).slice(0, SCOPE_PATHS_MAX_COUNT);
    return [[workspaceKey.trim().slice(0, SCOPE_WORKSPACE_KEY_MAX_LENGTH), normalizedPaths] as const];
  });
  return Object.fromEntries(entries);
}

function normalizeSettings(value: unknown, isDesktop: boolean): AppSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const customThemes = normalizeCustomThemes(raw.customThemes);
  const activeCustomThemeId = normalizeActiveCustomThemeId(raw.activeCustomThemeId, customThemes);
  return {
    showTitle: raw.showTitle === true,
    defaultHtmlPreview: raw.defaultHtmlPreview !== false,
    defaultHtmlCodeBlockPreview: typeof raw.defaultHtmlCodeBlockPreview === 'boolean'
      ? raw.defaultHtmlCodeBlockPreview
      : raw.defaultHtmlPreview !== false,
    defaultCsvPreview: raw.defaultCsvPreview !== false,
    fileTabs: raw.fileTabs === true,
    documentConversion: raw.documentConversion === true,
    scopeFocus: normalizeScopeFocus(raw.scopeFocus),
    desktopViewMode: normalizeDesktopViewMode(raw.desktopViewMode),
    keybindings: normalizeKeybindings(normalizeKeybindingsForImport(raw.keybindings), isDesktop),
    language: typeof raw.language === 'string' && raw.language.trim()
      ? raw.language.trim().slice(0, IMPORTED_LANGUAGE_MAX_LENGTH)
      : 'en',
    customThemes,
    activeCustomThemeId,
  };
}

export function createSettingsExport(params: {
  theme: ThemeMode;
  themeStyle: ThemeStyle;
  settings: AppSettings;
  recentWorkspaces: readonly RecentWorkspace[];
  appVersion?: string;
}): SettingsExportEnvelope {
  return {
    kind: SETTINGS_EXPORT_KIND,
    schemaVersion: SETTINGS_EXPORT_SCHEMA_VERSION,
    appVersion: params.appVersion,
    exportedAt: new Date().toISOString(),
    payload: {
      theme: params.theme,
      themeStyle: params.themeStyle,
      settings: {
        ...params.settings,
        customThemes: normalizeCustomThemes(params.settings.customThemes) as CustomTheme[],
      },
      recentWorkspaces: normalizeRecentWorkspaces(params.recentWorkspaces),
      localUi: {
        sidebarWidth: normalizeStorageNumber(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)),
        tocWidth: normalizeStorageNumber(localStorage.getItem(TOC_WIDTH_STORAGE_KEY)),
        workspaceAliases: readLocalStorageJson(WORKSPACE_ALIASES_STORAGE_KEY),
        desktopTabs: readLocalStorageJson(DESKTOP_TABS_STORAGE_KEY),
      },
    },
  };
}

export function parseSettingsImport(rawText: string, isDesktop: boolean): ImportedSettingsPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new SettingsImportError('invalidJson', 'The selected file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new SettingsImportError('missingData', 'The selected file does not contain settings data.');
  }
  const envelope = parsed as Record<string, unknown>;
  if (envelope.kind !== SETTINGS_EXPORT_KIND) {
    throw new SettingsImportError('wrongFile', 'This is not a Markdown Explorer settings file.');
  }
  const schemaVersion = Number(envelope.schemaVersion);
  if (!Number.isFinite(schemaVersion) || schemaVersion < 1) {
    throw new SettingsImportError('unknownSchema', 'This settings file uses an unknown schema version.');
  }

  const payload = envelope.payload && typeof envelope.payload === 'object'
    ? envelope.payload as Record<string, unknown>
    : {};
  return {
    theme: normalizeThemeMode(payload.theme),
    themeStyle: normalizeThemeStyle(payload.themeStyle),
    settings: normalizeSettings(payload.settings, isDesktop),
    recentWorkspaces: normalizeRecentWorkspaces(payload.recentWorkspaces),
    localUi: (() => {
      const rawLocalUi = payload.localUi && typeof payload.localUi === 'object'
        ? payload.localUi as Record<string, unknown>
        : {};
      return {
        sidebarWidth: typeof rawLocalUi.sidebarWidth === 'string' ? rawLocalUi.sidebarWidth : undefined,
        tocWidth: typeof rawLocalUi.tocWidth === 'string' ? rawLocalUi.tocWidth : undefined,
        workspaceAliases: rawLocalUi.workspaceAliases,
        desktopTabs: rawLocalUi.desktopTabs,
      };
    })(),
  };
}

export function restoreLocalUiSettings(localUi: ImportedSettingsPayload['localUi']) {
  const sidebarWidth = normalizeStorageNumber(localUi.sidebarWidth ?? null);
  const tocWidth = normalizeStorageNumber(localUi.tocWidth ?? null);
  if (sidebarWidth) {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, sidebarWidth);
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
  }
  if (tocWidth) {
    localStorage.setItem(TOC_WIDTH_STORAGE_KEY, tocWidth);
    document.documentElement.style.setProperty('--toc-width', `${tocWidth}px`);
  }
  writeJsonStorage(WORKSPACE_ALIASES_STORAGE_KEY, localUi.workspaceAliases);
  writeJsonStorage(DESKTOP_TABS_STORAGE_KEY, localUi.desktopTabs);
}
