export function useIsDark(theme: 'light' | 'dark' | 'auto'): boolean {
  if (theme === 'dark') return true;
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}
