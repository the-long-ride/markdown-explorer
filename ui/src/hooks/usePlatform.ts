export interface RuntimeEnv {
  isElectron: boolean;
  isDesktop: boolean;
  isChrome: boolean;
  isDesktopLike: boolean;
}

export function useRuntimeEnv(): RuntimeEnv {
  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const isChrome = typeof (window as any).__chromeExtBus !== 'undefined';
  return {
    isElectron,
    isDesktop: isElectron,
    isChrome,
    isDesktopLike: isElectron || isChrome,
  };
}
