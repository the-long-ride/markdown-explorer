import type { AppRuntime, DesktopViewMode, PetThemeStyle, ThemeMode, ThemeStyle } from '../types';
import { supportsWorkspaceInsights } from '../insights/runtimeCapabilities';

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
  expandAll: 'Ctrl+Alt+x',
  workspaceSelection: 'Ctrl+Alt+W',
  toggleSidebar: 'Alt+A',
  openFiles: 'Alt+Shift+E',
  openBookmarks: 'Alt+Shift+B',
  toggleToc: 'Alt+C',
  sidebarCursorMode: 'Alt+Z',
  locateFile: 'Alt+Q',
  toggleFocusMode: 'Ctrl+Alt+F',
  toggleHtmlPreview: 'Ctrl+Alt+H',
  toggleWorkspaceInsights: 'Ctrl+Alt+I',
  saveCurrentDocument: 'Ctrl+S',
  editCurrentDocument: 'Ctrl+Alt+E',
  plainEditCurrentDocument: 'Ctrl+Alt+Shift+E',
  editorBold: 'Ctrl+B',
  editorItalic: 'Ctrl+I',
  editorUnderline: 'Ctrl+U',
  editorInlineCode: 'Ctrl+`',
  editorLink: 'Ctrl+K',
  editorCodeBlock: 'Ctrl+Shift+C',
  editorQuote: 'Ctrl+Shift+Q',
  editorBulletList: 'Ctrl+Shift+8',
  editorNumberedList: 'Ctrl+Shift+7',
  editorTaskList: 'Ctrl+Shift+9',
  editorDecreaseFontSize: 'Ctrl+Alt+-',
  editorIncreaseFontSize: 'Ctrl+Alt+=',
};

const { toggleWorkspaceInsights: _toggleWorkspaceInsights, ...VSCODE_SHARED_KEYBINDINGS } = DEFAULT_KEYBINDINGS;

export const VSCODE_DEFAULT_KEYBINDINGS: Record<string, string> = {
  ...VSCODE_SHARED_KEYBINDINGS,
  editCurrentDocument: 'Ctrl+Alt+E',
  plainEditCurrentDocument: 'Ctrl+Alt+Shift+E',
  reloadWindow: 'Ctrl+Shift+R',
};

export const DESKTOP_DEFAULT_KEYBINDINGS: Record<string, string> = {
  ...DEFAULT_KEYBINDINGS,
  editCurrentDocument: 'Ctrl+E',
  plainEditCurrentDocument: 'Ctrl+Alt+E',
  reloadWindow: 'Ctrl+F5',
  zoomIn: 'Ctrl+=',
  zoomOut: 'Ctrl+-',
  resetZoom: 'Ctrl+0',
  editorDecreaseFontSize: 'Ctrl+-',
  editorIncreaseFontSize: 'Ctrl+=',
  refresh: 'F5',
  settings: 'Ctrl+,',
  searchCurrent: 'Ctrl+F',
  searchAllTabs: 'Ctrl+Shift+F',
  findCurrentFile: 'F',
  toggleTheme: 'Ctrl+L',
  toggleSidebar: 'Ctrl+B',
  openFiles: 'Ctrl+Shift+E',
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
    id: 'raw-grid',
    label: 'Default',
    description: 'Visible structure, asymmetric panels, and mechanical borders.',
  },
  {
    id: 'default',
    label: 'Explorer Classic',
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
    id: 'cyberpunk',
    label: 'Cyberpunk',
    description: 'Machined controls, cut-corner cyberdeck geometry, and signal yellow/vermilion accents.',
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
    label: 'K-Ink',
    description: 'A personal K-Ink theme with expressive ears, warm amber eyes, and anime sticker energy.',
  },
  {
    id: 'pet-white-shiba',
    label: 'Nika',
    description: 'Warm and playful companion theme with joyful energy.',
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
  if (runtime === 'vscode' || runtime === 'web') {
    if (normalized.editCurrentDocument === 'Ctrl+E') {
      normalized.editCurrentDocument = 'Ctrl+Alt+E';
    }
    if (normalized.plainEditCurrentDocument === 'Ctrl+Shift+E') {
      normalized.plainEditCurrentDocument = 'Ctrl+Alt+Shift+E';
    }
  }
  if (runtime === 'web') {
    delete normalized.reloadWindow;
  }
  if (!supportsWorkspaceInsights(runtime)) delete normalized.toggleWorkspaceInsights;
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
  if (value === 'night-city-2077') return 'cyberpunk';
  if (value === 'pet-shiba') return 'pet-white-shiba';
  return ALL_THEME_STYLE_OPTIONS.some((option) => option.id === value)
    ? (value as ThemeStyle)
    : 'raw-grid';
}

export function normalizeDesktopViewMode(value: unknown): DesktopViewMode {
  return value === 'tabs' ? 'tabs' : 'focus';
}
