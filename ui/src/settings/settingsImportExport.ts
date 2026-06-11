import {
  DESKTOP_TABS_STORAGE_KEY,
  FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY,
  FLOATING_TOOLBAR_STORAGE_KEY,
  WORKSPACE_ALIASES_STORAGE_KEY,
} from '../desktop/constants';
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

export const SETTINGS_EXPORT_KIND = 'markdown-explorer-settings';
export const SETTINGS_EXPORT_SCHEMA_VERSION = 1;

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
      readonly floatingToolbarPosition?: unknown;
      readonly floatingToolbarCollapsed?: string;
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

function writeJsonStorage(key: string, value: unknown, maxLength = 350_000) {
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
      ? raw.name.trim().slice(0, 120)
      : pathParts[pathParts.length - 1] ?? path;
    const lastOpened = Number(raw.lastOpened);
    return [{
      name,
      path,
      lastOpened: Number.isFinite(lastOpened) ? lastOpened : Date.now(),
    }];
  }).slice(0, 100);
}

function normalizeKeybindingsForImport(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entries = Object.entries(value as Record<string, unknown>).flatMap(([key, shortcut]) => {
    if (typeof key !== 'string' || typeof shortcut !== 'string') return [];
    const normalizedShortcut = shortcut.trim().slice(0, 48);
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
      const normalizedPath = path.trim().slice(0, 1_000);
      if (!normalizedPath || seen.has(normalizedPath)) return [];
      seen.add(normalizedPath);
      return [normalizedPath];
    }).slice(0, 10_000);
    return [[workspaceKey.trim().slice(0, 1_000), normalizedPaths] as const];
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
    fileTabs: raw.fileTabs === true,
    documentConversion: raw.documentConversion === true,
    scopeFocus: normalizeScopeFocus(raw.scopeFocus),
    desktopViewMode: normalizeDesktopViewMode(raw.desktopViewMode),
    keybindings: normalizeKeybindings(normalizeKeybindingsForImport(raw.keybindings), isDesktop),
    language: typeof raw.language === 'string' && raw.language.trim()
      ? raw.language.trim().slice(0, 12)
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
        sidebarWidth: normalizeStorageNumber(localStorage.getItem('markdown-explorer-sidebar-width')),
        tocWidth: normalizeStorageNumber(localStorage.getItem('markdown-explorer-toc-width')),
        workspaceAliases: readLocalStorageJson(WORKSPACE_ALIASES_STORAGE_KEY),
        desktopTabs: readLocalStorageJson(DESKTOP_TABS_STORAGE_KEY),
        floatingToolbarPosition: readLocalStorageJson(FLOATING_TOOLBAR_STORAGE_KEY),
        floatingToolbarCollapsed: localStorage.getItem(FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY) ?? undefined,
      },
    },
  };
}

export function parseSettingsImport(rawText: string, isDesktop: boolean): ImportedSettingsPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('The selected file does not contain settings data.');
  }
  const envelope = parsed as Record<string, unknown>;
  if (envelope.kind !== SETTINGS_EXPORT_KIND) {
    throw new Error('This is not a Markdown Explorer settings file.');
  }
  const schemaVersion = Number(envelope.schemaVersion);
  if (!Number.isFinite(schemaVersion) || schemaVersion < 1) {
    throw new Error('This settings file uses an unknown schema version.');
  }

  const payload = envelope.payload && typeof envelope.payload === 'object'
    ? envelope.payload as Record<string, unknown>
    : {};
  return {
    theme: normalizeThemeMode(payload.theme),
    themeStyle: normalizeThemeStyle(payload.themeStyle),
    settings: normalizeSettings(payload.settings, isDesktop),
    recentWorkspaces: normalizeRecentWorkspaces(payload.recentWorkspaces),
    localUi: payload.localUi && typeof payload.localUi === 'object'
      ? payload.localUi as SettingsExportEnvelope['payload']['localUi']
      : {},
  };
}

export function restoreLocalUiSettings(localUi: ImportedSettingsPayload['localUi']) {
  const sidebarWidth = normalizeStorageNumber(localUi.sidebarWidth ?? null);
  const tocWidth = normalizeStorageNumber(localUi.tocWidth ?? null);
  if (sidebarWidth) {
    localStorage.setItem('markdown-explorer-sidebar-width', sidebarWidth);
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
  }
  if (tocWidth) {
    localStorage.setItem('markdown-explorer-toc-width', tocWidth);
    document.documentElement.style.setProperty('--toc-width', `${tocWidth}px`);
  }
  writeJsonStorage(WORKSPACE_ALIASES_STORAGE_KEY, localUi.workspaceAliases);
  writeJsonStorage(DESKTOP_TABS_STORAGE_KEY, localUi.desktopTabs);
  writeJsonStorage(FLOATING_TOOLBAR_STORAGE_KEY, localUi.floatingToolbarPosition, 20_000);
  if (localUi.floatingToolbarCollapsed === 'true' || localUi.floatingToolbarCollapsed === 'false') {
    localStorage.setItem(FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY, localUi.floatingToolbarCollapsed);
  }
}
