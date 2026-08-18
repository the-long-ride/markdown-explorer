export type AppThemeMode = 'auto' | 'light' | 'dark';
export type ConcreteThemeMode = 'light' | 'dark';

/**
 * Resolve the user's app theme setting (`auto` / `light` / `dark`) to a concrete
 * mode used by renderers and affordances that must commit to one. When `theme`
 * is `auto`, the media query `prefers-color-scheme: dark` decides.
 *
 * Pass `win` only when injecting a custom window (tests). In production code
 * the ambient `window` is used.
 */
export function resolveThemeMode(
  theme: AppThemeMode,
  win: Window & typeof globalThis = (typeof window !== 'undefined'
    ? window
    : (globalThis as unknown as Window & typeof globalThis)),
): ConcreteThemeMode {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  // auto
  try {
    return win.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
