import type { AppRuntime, DesktopViewMode, PetThemeStyle, ThemeMode, ThemeStyle } from '../types';

export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  searchCurrent: 'Ctrl+K',
  searchAllTabs: 'Ctrl+Shift+K',
  findCurrentFile: 'K',
  back: 'Ctrl+ArrowLeft',
  forward: 'Ctrl+ArrowRight',
  welcome: 'Ctrl+h',
  settings: 'Ctrl+i',
  toggleTheme: 'Ctrl+Shift+l',
  refresh: 'R',
  collapseAll: 'Ctrl+Shift+x',
  expandAll: 'Ctrl+Shift+e',
  workspaceSelection: 'Ctrl+Alt+W',
  toggleSidebar: 'Alt+A',
  openBookmarks: 'Alt+Shift+B',
  toggleToc: 'Alt+C',
  sidebarCursorMode: 'Alt+Z',
  locateFile: 'Alt+Q',
  toggleFocusMode: 'Ctrl+Alt+F',
  toggleHtmlPreview: 'Ctrl+Alt+H',
  toggleWorkspaceInsights: 'Ctrl+Alt+I',
  saveCurrentDocument: 'Ctrl+S',
};

export const VSCODE_DEFAULT_KEYBINDINGS: Record<string, string> = {
  ...DEFAULT_KEYBINDINGS,
  editCurrentDocument: 'Ctrl+Alt+E',
};

export const DESKTOP_DEFAULT_KEYBINDINGS: Record<string, string> = {
  ...DEFAULT_KEYBINDINGS,
  editCurrentDocument: 'Ctrl+E',
  zoomIn: 'Ctrl+=',
  zoomOut: 'Ctrl+-',
  resetZoom: 'Ctrl+Alt+Z',
  refresh: 'F5',
  settings: 'Ctrl+,',
  searchCurrent: 'Ctrl+F',
  searchAllTabs: 'Ctrl+Shift+F',
  findCurrentFile: 'F',
  toggleTheme: 'Ctrl+L',
  toggleSidebar: 'Ctrl+B',
  openBookmarks: 'Ctrl+Shift+B',
  toggleToc: 'Ctrl+T',
  workspaceSelection: 'Ctrl+N',
  toggleDesktopViewMode: 'Ctrl+Alt+T',
  openCurrentDocumentLocation: 'Shift+Alt+R',
  closeContentTab: 'Ctrl+W',
  closeAllContentTabs: 'Ctrl+Shift+W',
  closeContentTabsToRight: 'Ctrl+Alt+W',
  closeOtherContentTabs: 'Ctrl+Alt+O',
};

export function getDefaultKeybindings(isDesktop: boolean): Record<string, string> {
  return isDesktop ? DESKTOP_DEFAULT_KEYBINDINGS : VSCODE_DEFAULT_KEYBINDINGS;
}

export function getDefaultKeybindingsForRuntime(runtime: AppRuntime): Record<string, string> {
  if (runtime === 'desktop' || runtime === 'tauri') return DESKTOP_DEFAULT_KEYBINDINGS;
  if (runtime === 'vscode') return VSCODE_DEFAULT_KEYBINDINGS;
  return DEFAULT_KEYBINDINGS;
}

export const THEME_MODE_OPTIONS: readonly { id: ThemeMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export const THEME_STYLE_OPTIONS: readonly {
  id: Exclude<ThemeStyle, PetThemeStyle>;
  label: string;
  description: string;
}[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Compact reader surfaces with the original Markdown Explorer balance.',
  },
  {
    id: 'bento',
    label: 'Bento Grids',
    description: 'Modular blocks, stronger structure, and denser scan-friendly spacing.',
  },
  {
    id: 'vercel',
    label: 'Vercel',
    description: 'High-contrast monochrome, sharp borders, and geometric focus.',
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    description: 'Synthwave cyber aesthetic with vibrant neon highlights and deep night contrast.',
  },
  {
    id: 'neon-voltage',
    label: 'Neon Voltage',
    description: 'Deep black surfaces with electric coral, teal, and purple glow.',
  },
  {
    id: 'raw-grid',
    label: 'Raw Grid',
    description: 'Visible structure, asymmetric panels, and mechanical borders.',
  },
];

export const DEFAULT_PET_THEME_STYLE: PetThemeStyle = 'pet-white-shiba';

export const PET_THEME_STYLE_OPTIONS: readonly {
  id: PetThemeStyle;
  label: string;
  description: string;
}[] = [
  {
    id: 'pet-k-ink',
    label: "K-Ink (app author's dog)",
    description: 'A personal K-Ink theme with expressive ears, warm amber eyes, and anime sticker energy.',
  },
  {
    id: 'pet-white-shiba',
    label: 'White Shiba',
    description: 'Snowy fur, warm ears, and a calm little desk buddy.',
  },
  {
    id: 'pet-cat',
    label: 'Cat',
    description: 'Soft midnight whiskers, fish-bone marks, and nimble motion.',
  },
  {
    id: 'pet-hamster',
    label: 'Hamster',
    description: 'Seed colors, round cheeks, and a pocket-sized reading rhythm.',
  },
  {
    id: 'pet-corgi',
    label: 'Corgi',
    description: 'Golden loaf shapes, sky notes, and a wagging workspace mood.',
  },
];

export const ALL_THEME_STYLE_OPTIONS = [
  ...THEME_STYLE_OPTIONS,
  ...PET_THEME_STYLE_OPTIONS,
] as const;

export function isPetThemeStyle(value: ThemeStyle): value is PetThemeStyle {
  return PET_THEME_STYLE_OPTIONS.some((option) => option.id === value);
}

export function normalizeKeybindings(
  saved: Record<string, string> | undefined,
  isDesktop: boolean,
): Record<string, string> {
  return {
    ...getDefaultKeybindings(isDesktop),
    ...(saved ?? {}),
  };
}

export function normalizeKeybindingsForRuntime(
  saved: Record<string, string> | undefined,
  runtime: AppRuntime,
): Record<string, string> {
  const normalized = {
    ...getDefaultKeybindingsForRuntime(runtime),
    ...(saved ?? {}),
  };
  if (runtime === 'chrome') delete normalized.editCurrentDocument;
  if (runtime !== 'desktop' && runtime !== 'tauri') {
    delete normalized.zoomIn;
    delete normalized.zoomOut;
    delete normalized.resetZoom;
  }
  return normalized;
}

export function normalizeThemeMode(value: unknown): ThemeMode {
  return THEME_MODE_OPTIONS.some((option) => option.id === value)
    ? (value as ThemeMode)
    : 'auto';
}

export function normalizeThemeStyle(value: unknown): ThemeStyle {
  if (value === 'pet-shiba-memes') return 'tokyo-night';
  if (value === 'pet-shiba') return 'pet-white-shiba';
  return ALL_THEME_STYLE_OPTIONS.some((option) => option.id === value)
    ? (value as ThemeStyle)
    : 'default';
}

export function normalizeDesktopViewMode(value: unknown): DesktopViewMode {
  return value === 'tabs' ? 'tabs' : 'focus';
}
