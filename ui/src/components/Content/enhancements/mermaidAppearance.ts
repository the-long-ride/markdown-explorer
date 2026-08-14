interface MermaidAppearanceState {
  theme: string;
  themeStyle?: string;
  settings?: {
    activeCustomThemeId?: string | null;
    customThemes?: unknown;
    fontBindings?: { mermaid?: unknown };
  };
}

export interface MermaidAppearanceSyncResult {
  readonly key: string;
  readonly changed: boolean;
}

export function createMermaidAppearanceKey(state: MermaidAppearanceState): string {
  return JSON.stringify({
    theme: state.theme,
    themeStyle: state.themeStyle,
    activeCustomThemeId: state.settings?.activeCustomThemeId ?? null,
    customThemes: state.settings?.customThemes ?? [],
    mermaidFont: state.settings?.fontBindings?.mermaid ?? null,
  });
}

export function syncMermaidAppearance(
  previousKey: string | null,
  state: MermaidAppearanceState,
): MermaidAppearanceSyncResult {
  const key = createMermaidAppearanceKey(state);
  return { key, changed: previousKey !== null && previousKey !== key };
}

export function subscribeToAutoMermaidTheme(
  theme: string,
  onChange: () => void,
): () => void {
  if (theme !== 'auto' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
