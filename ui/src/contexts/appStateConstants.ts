import type { DesktopViewMode, PetThemeStyle, ThemeMode, ThemeStyle } from '../types';

export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  searchCurrent: 'Ctrl+K',
  searchAllTabs: 'Ctrl+Shift+K',
  findCurrentFile: 'K',
  back: 'Ctrl+ArrowLeft',
  forward: 'Ctrl+ArrowRight',
  welcome: 'Ctrl+h',
  settings: 'Ctrl+i',
  toggleTheme: 'Ctrl+Shift+l',
  refresh: 'F5',
  collapseAll: 'Ctrl+Shift+x',
  expandAll: 'Ctrl+Shift+e',
  workspaceSelection: 'Ctrl+Alt+W',
  toggleSidebar: 'Ctrl+Shift+p',
  toggleToc: 'Ctrl+T',
  sidebarCursorMode: 'Alt+S',
  zoomIn: 'Ctrl+=',
  zoomOut: 'Ctrl+-',
  locateFile: 'Ctrl+Q',
  toggleFocusMode: 'Ctrl+Alt+F',
};

export const DESKTOP_DEFAULT_KEYBINDINGS: Record<string, string> = {
  ...DEFAULT_KEYBINDINGS,
  searchCurrent: 'Ctrl+F',
  searchAllTabs: 'Ctrl+Shift+F',
  findCurrentFile: 'F',
  toggleTheme: 'Ctrl+L',
  toggleSidebar: 'Ctrl+B',
  workspaceSelection: 'Ctrl+N',
  toggleDesktopViewMode: 'Ctrl+Alt+T',
  closeContentTab: 'Ctrl+W',
  closeAllContentTabs: 'Ctrl+Shift+W',
  closeContentTabsToRight: 'Ctrl+Alt+W',
  closeOtherContentTabs: 'Ctrl+Alt+O',
};

export function getDefaultKeybindings(isDesktop: boolean): Record<string, string> {
  const isChrome = typeof (window as any).__chromeExtBus !== 'undefined';
  if (isChrome) {
    return {
      ...DEFAULT_KEYBINDINGS,
      refresh: 'Alt+R',
    };
  }
  return isDesktop ? DESKTOP_DEFAULT_KEYBINDINGS : DEFAULT_KEYBINDINGS;
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
    id: 'glass',
    label: 'Evolved Glass',
    description: 'Layered translucent panels, softer strokes, and airy document rhythm.',
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
];

export const DEFAULT_PET_THEME_STYLE: PetThemeStyle = 'pet-shiba';

export const PET_THEME_STYLE_OPTIONS: readonly {
  id: PetThemeStyle;
  label: string;
  description: string;
}[] = [
  {
    id: 'pet-white-shiba',
    label: 'White Shiba',
    description: 'Snowy fur, warm ears, and a calm little desk buddy.',
  },
  {
    id: 'pet-shiba',
    label: 'Normal Shiba',
    description: 'Toasted orange, curled-tail energy with cheerful paw trails.',
  },
  {
    id: 'pet-shiba-memes',
    label: 'Black Shiba',
    description: 'A dark Shiba theme with inky fur, bright eyes, and cheerful desk-buddy energy.',
  },
  {
    id: 'pet-k-ink',
    label: "K-Ink (app author's dog)",
    description: 'A personal K-Ink theme with expressive ears, warm amber eyes, and anime sticker energy.',
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

export function normalizeThemeMode(value: unknown): ThemeMode {
  return THEME_MODE_OPTIONS.some((option) => option.id === value)
    ? (value as ThemeMode)
    : 'auto';
}

export function normalizeThemeStyle(value: unknown): ThemeStyle {
  return ALL_THEME_STYLE_OPTIONS.some((option) => option.id === value)
    ? (value as ThemeStyle)
    : 'default';
}

export function normalizeDesktopViewMode(value: unknown): DesktopViewMode {
  return value === 'tabs' ? 'tabs' : 'focus';
}
