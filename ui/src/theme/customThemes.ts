import { normalizeThemeMode, normalizeThemeStyle } from '../contexts/appStateConstants';
import type {
  AppSettings,
  CustomTheme,
  CustomThemeBackground,
  CustomThemeColorKey,
  CustomThemeColorOverrides,
  CustomThemeLayout,
  CustomThemeScheme,
  ThemeMode,
} from '../types';

export const MAX_CUSTOM_THEMES = 24;
export const MAX_BACKGROUND_DATA_URL_LENGTH = 900_000;

export const CUSTOM_THEME_COLOR_OPTIONS: readonly {
  key: CustomThemeColorKey;
  label: string;
  cssVar: string;
}[] = [
  { key: 'accent', label: 'Accent', cssVar: '--accent' },
  { key: 'accentText', label: 'Accent text', cssVar: '--accent-text' },
  { key: 'bg', label: 'Background', cssVar: '--bg' },
  { key: 'surface', label: 'Panel', cssVar: '--bg-s' },
  { key: 'elevated', label: 'Raised panel', cssVar: '--bg-e' },
  { key: 'hover', label: 'Hover surface', cssVar: '--bg-h' },
  { key: 'active', label: 'Active surface', cssVar: '--bg-a' },
  { key: 'code', label: 'Code surface', cssVar: '--bg-code' },
  { key: 'text', label: 'Text', cssVar: '--tx' },
  { key: 'textMuted', label: 'Secondary text', cssVar: '--tx2' },
  { key: 'textSoft', label: 'Soft text', cssVar: '--txm' },
  { key: 'textSubtle', label: 'Subtle text', cssVar: '--tx3' },
  { key: 'border', label: 'Border', cssVar: '--bd-s' },
  { key: 'borderStrong', label: 'Strong border', cssVar: '--bd-x' },
  { key: 'success', label: 'Success', cssVar: '--success' },
  { key: 'danger', label: 'Danger', cssVar: '--danger' },
  { key: 'chart1', label: 'Chart 1', cssVar: '--chart-1' },
  { key: 'chart2', label: 'Chart 2', cssVar: '--chart-2' },
  { key: 'chart3', label: 'Chart 3', cssVar: '--chart-3' },
  { key: 'chart4', label: 'Chart 4', cssVar: '--chart-4' },
];

const CUSTOM_THEME_LAYOUT_OPTIONS: readonly {
  key: keyof Required<CustomThemeLayout>;
  cssVar: string;
  unit: string;
}[] = [
  { key: 'radius', cssVar: '--r', unit: 'px' },
  { key: 'strokeWidth', cssVar: '--stroke-w', unit: 'px' },
  { key: 'contentPadding', cssVar: '--content-pad-x', unit: 'px' },
  { key: 'sectionGap', cssVar: '--section-gap', unit: 'px' },
];

const DENSITY_TOKENS: Record<NonNullable<CustomThemeLayout['density']>, Record<string, string>> = {
  compact: {
    '--topbar-h': '44px',
    '--content-pad-y': '18px',
    '--section-header-pad-y': '7px',
    '--section-body-pad-y': '10px',
    '--table-cell-pad-y': '5px',
  },
  comfortable: {
    '--topbar-h': '48px',
    '--content-pad-y': '24px',
    '--section-header-pad-y': '10px',
    '--section-body-pad-y': '14px',
    '--table-cell-pad-y': '7px',
  },
  spacious: {
    '--topbar-h': '52px',
    '--content-pad-y': '32px',
    '--section-header-pad-y': '13px',
    '--section-body-pad-y': '18px',
    '--table-cell-pad-y': '9px',
  },
};

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const DATA_IMAGE_RE = /^data:image\/(?:png|jpe?g|webp|gif);base64,/i;

function clampNumber(value: unknown, min: number, max: number): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return undefined;
  return trimmed.toLowerCase();
}

function normalizeColorOverrides(value: unknown): CustomThemeColorOverrides | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entries = CUSTOM_THEME_COLOR_OPTIONS.flatMap((option) => {
    const normalized = normalizeHexColor((value as Record<string, unknown>)[option.key]);
    return normalized ? [[option.key, normalized] as const] : [];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeLayout(value: unknown): CustomThemeLayout | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const density =
    raw.density === 'compact' || raw.density === 'spacious' ? raw.density : 'comfortable';
  const layout: CustomThemeLayout = {
    density,
    radius: clampNumber(raw.radius, 0, 18),
    strokeWidth: clampNumber(raw.strokeWidth, 0, 3),
    contentPadding: clampNumber(raw.contentPadding, 16, 64),
    sectionGap: clampNumber(raw.sectionGap, 4, 28),
  };
  return layout;
}

function normalizeBackground(value: unknown): CustomThemeBackground | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const type = raw.type === 'image' ? 'image' : 'none';
  const imageDataUrl =
    typeof raw.imageDataUrl === 'string' &&
    raw.imageDataUrl.length <= MAX_BACKGROUND_DATA_URL_LENGTH &&
    DATA_IMAGE_RE.test(raw.imageDataUrl)
      ? raw.imageDataUrl
      : undefined;

  return {
    type: type === 'image' && imageDataUrl ? 'image' : 'none',
    imageDataUrl,
    opacity: clampNumber(raw.opacity, 0, 0.5) ?? 0.16,
    fit: raw.fit === 'contain' ? 'contain' : 'cover',
    position: typeof raw.position === 'string' && raw.position.trim()
      ? raw.position.trim().slice(0, 48)
      : 'center',
    blur: clampNumber(raw.blur, 0, 18) ?? 0,
  };
}

export function normalizeCustomThemes(value: unknown): CustomTheme[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const now = Date.now();

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id.trim().slice(0, 64) : '';
    if (!id || seen.has(id)) return [];
    seen.add(id);

    const name = typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim().slice(0, 48)
      : 'Custom theme';
    const dark = normalizeColorOverrides((raw.colors as Record<string, unknown> | undefined)?.dark);
    const light = normalizeColorOverrides((raw.colors as Record<string, unknown> | undefined)?.light);
    const colors = dark || light ? { dark, light } : undefined;

    return [{
      id,
      name,
      baseStyle: normalizeThemeStyle(raw.baseStyle),
      colorMode: normalizeThemeMode(raw.colorMode),
      createdAt: clampNumber(raw.createdAt, 0, now) ?? now,
      updatedAt: clampNumber(raw.updatedAt, 0, now) ?? now,
      colors,
      layout: normalizeLayout(raw.layout),
      background: normalizeBackground(raw.background),
    }];
  }).slice(0, MAX_CUSTOM_THEMES);
}

export function normalizeActiveCustomThemeId(
  value: unknown,
  customThemes: readonly CustomTheme[],
): string | undefined {
  return typeof value === 'string' && customThemes.some((theme) => theme.id === value)
    ? value
    : undefined;
}

export function getActiveCustomTheme(settings: AppSettings): CustomTheme | undefined {
  const customThemes = settings.customThemes ?? [];
  const activeId = settings.activeCustomThemeId;
  return activeId ? customThemes.find((theme) => theme.id === activeId) : undefined;
}

function getCurrentScheme(themeMode: ThemeMode): CustomThemeScheme {
  if (themeMode === 'light') return 'light';
  if (themeMode === 'dark') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function clearCustomThemeCss(root: HTMLElement) {
  root.removeAttribute('data-custom-theme-id');
  for (const option of CUSTOM_THEME_COLOR_OPTIONS) {
    root.style.removeProperty(option.cssVar);
  }
  root.style.removeProperty('--bd');
  root.style.removeProperty('--accent-dim');
  root.style.removeProperty('--inline-code-bg');
  root.style.removeProperty('--inline-code-border');
  root.style.removeProperty('--inline-code-fg');
  root.style.removeProperty('--content-pad-y');
  root.style.removeProperty('--content-pad-x');
  root.style.removeProperty('--section-gap');
  root.style.removeProperty('--section-header-pad-y');
  root.style.removeProperty('--section-body-pad-y');
  root.style.removeProperty('--table-cell-pad-y');
  for (const option of CUSTOM_THEME_LAYOUT_OPTIONS) {
    root.style.removeProperty(option.cssVar);
  }
  root.style.removeProperty('--custom-theme-bg-image');
  root.style.removeProperty('--custom-theme-bg-opacity');
  root.style.removeProperty('--custom-theme-bg-fit');
  root.style.removeProperty('--custom-theme-bg-position');
  root.style.removeProperty('--custom-theme-bg-blur');
}

function applyColorOverrides(root: HTMLElement, theme: CustomTheme, scheme: CustomThemeScheme) {
  const colors = {
    ...(theme.colors?.[scheme] ?? {}),
  };
  for (const option of CUSTOM_THEME_COLOR_OPTIONS) {
    const value = colors[option.key];
    if (value) root.style.setProperty(option.cssVar, value);
  }

  if (colors.border) {
    root.style.setProperty('--bd', `${colors.border}55`);
  }
  if (colors.accent) {
    root.style.setProperty('--accent-dim', `${colors.accent}26`);
  }
  if (colors.accent || colors.code) {
    root.style.setProperty('--inline-code-bg', `color-mix(in srgb, var(--accent) 10%, var(--bg-code))`);
    root.style.setProperty('--inline-code-border', `color-mix(in srgb, var(--accent) 28%, var(--bd-s))`);
    root.style.setProperty('--inline-code-fg', `color-mix(in srgb, var(--accent-text) 88%, var(--tx))`);
  }
}

function applyLayout(root: HTMLElement, layout: CustomThemeLayout | undefined) {
  if (!layout) return;
  const density = layout.density ?? 'comfortable';
  for (const [cssVar, value] of Object.entries(DENSITY_TOKENS[density])) {
    root.style.setProperty(cssVar, value);
  }
  for (const option of CUSTOM_THEME_LAYOUT_OPTIONS) {
    const value = layout[option.key];
    if (typeof value === 'number') {
      root.style.setProperty(option.cssVar, `${value}${option.unit}`);
      if (option.key === 'radius') {
        root.style.setProperty('--r-md', `${Math.max(value, 4)}px`);
        root.style.setProperty('--r-lg', `${Math.max(value, 6)}px`);
      }
      if (option.key === 'contentPadding') {
        root.style.setProperty('--content-pad-y', `${Math.max(14, Math.round(value * 0.68))}px`);
      }
    }
  }
}

function applyBackground(root: HTMLElement, background: CustomThemeBackground | undefined) {
  if (!background || background.type !== 'image' || !background.imageDataUrl) return;
  root.style.setProperty('--custom-theme-bg-image', `url("${background.imageDataUrl}")`);
  root.style.setProperty('--custom-theme-bg-opacity', String(background.opacity ?? 0.16));
  root.style.setProperty('--custom-theme-bg-fit', background.fit ?? 'cover');
  root.style.setProperty('--custom-theme-bg-position', background.position ?? 'center');
  root.style.setProperty('--custom-theme-bg-blur', `${background.blur ?? 0}px`);
}

export function applyCustomThemeToRoot(
  root: HTMLElement,
  theme: CustomTheme | undefined,
  themeMode: ThemeMode,
) {
  clearCustomThemeCss(root);
  if (!theme) return;
  root.dataset.customThemeId = theme.id;
  applyColorOverrides(root, theme, getCurrentScheme(theme.colorMode ?? themeMode));
  applyLayout(root, theme.layout);
  applyBackground(root, theme.background);
}
