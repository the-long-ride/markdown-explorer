// ── UI state ────────────────────────────────────────────────────────────────

export type ThemeMode = 'auto' | 'light' | 'dark';
export type DesktopViewMode = 'focus' | 'tabs';
export type PetThemeStyle =
  | 'pet-white-shiba'
  | 'pet-shiba'
  | 'pet-shiba-memes'
  | 'pet-k-ink'
  | 'pet-cat'
  | 'pet-hamster'
  | 'pet-corgi';

export type ThemeStyle = 'default' | 'glass' | 'bento' | 'vercel' | PetThemeStyle;

export type CustomThemeScheme = 'light' | 'dark';

export type CustomThemeColorKey =
  | 'bg'
  | 'surface'
  | 'elevated'
  | 'hover'
  | 'active'
  | 'code'
  | 'text'
  | 'textMuted'
  | 'textSoft'
  | 'textSubtle'
  | 'accent'
  | 'accentText'
  | 'border'
  | 'borderStrong'
  | 'success'
  | 'danger'
  | 'chart1'
  | 'chart2'
  | 'chart3'
  | 'chart4';

export type CustomThemeColorOverrides = Partial<Record<CustomThemeColorKey, string>>;

export interface CustomThemeLayout {
  readonly density?: 'compact' | 'comfortable' | 'spacious';
  readonly radius?: number;
  readonly strokeWidth?: number;
  readonly contentPadding?: number;
  readonly sectionGap?: number;
}

export interface CustomThemeBackground {
  readonly type?: 'none' | 'image';
  readonly imageDataUrl?: string;
  readonly opacity?: number;
  readonly fit?: 'cover' | 'contain';
  readonly position?: string;
  readonly blur?: number;
}

export interface CustomTheme {
  readonly id: string;
  readonly name: string;
  readonly baseStyle: ThemeStyle;
  readonly colorMode?: ThemeMode;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly colors?: Partial<Record<CustomThemeScheme, CustomThemeColorOverrides>>;
  readonly layout?: CustomThemeLayout;
  readonly background?: CustomThemeBackground;
}

export interface AppSettings {
  showTitle: boolean;
  defaultHtmlPreview: boolean;
  fileTabs: boolean;
  documentConversion: boolean;
  scopeFocus?: Record<string, string[]>;
  searchScopeFocus?: Record<string, string[]>;
  desktopViewMode?: DesktopViewMode;
  keybindings?: Record<string, string>;
  disabledKeybindings?: Record<string, boolean>;
  language?: string;
  customThemes?: CustomTheme[];
  activeCustomThemeId?: string;
}

export interface PersistedState {
  showTitle?: boolean;
  defaultHtmlPreview?: boolean;
  fileTabs?: boolean;
  documentConversion?: boolean;
  scopeFocus?: Record<string, string[]>;
  searchScopeFocus?: Record<string, string[]>;
  desktopViewMode?: DesktopViewMode;
  keybindings?: Record<string, string>;
  disabledKeybindings?: Record<string, boolean>;
  theme?: ThemeMode;
  themeStyle?: ThemeStyle;
  language?: string;
  customThemes?: CustomTheme[];
  activeCustomThemeId?: string;
}
