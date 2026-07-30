export interface UpdateState {
  readonly status: 'idle' | 'downloading' | 'downloaded' | 'scheduled-on-exit' | 'applying' | 'error';
  readonly version?: string;
  readonly downloadedVersion?: string;
  readonly downloadedFileName?: string;
  readonly stagedFilePath?: string;
  readonly progressPercent?: number;
  readonly error?: string;
}

export type AppRuntime = 'desktop' | 'vscode' | 'chrome' | 'tauri';
export type HostPlatform = 'windows' | 'macos' | 'linux' | 'unknown';
export type WorkspaceUnavailableReason = 'missing' | 'locked';
export type ShellLocationMode = 'open-directory' | 'reveal-file' | 'open-parent-directory';

export type {
  AppSettings,
  CustomTheme,
  CustomThemeBackground,
  CustomThemeColorKey,
  CustomThemeColorOverrides,
  CustomThemeLayout,
  CustomThemeScheme,
  DesktopViewMode,
  PersistedState,
  PetThemeStyle,
  ThemeMode,
  ThemeStyle,
} from '../themeTypes';
