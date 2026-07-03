import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useRuntimeEnv } from '../../../../ui/src/hooks/usePlatform';

describe('usePlatform', () => {
  let originalElectronAPI: any;
  let originalChromeBus: any;

  beforeEach(() => {
    originalElectronAPI = (window as any).electronAPI;
    originalChromeBus = (window as any).__chromeExtBus;
    delete (window as any).electronAPI;
    delete (window as any).__chromeExtBus;
  });

  afterEach(() => {
    (window as any).electronAPI = originalElectronAPI;
    (window as any).__chromeExtBus = originalChromeBus;
  });

  it('returns isDesktop=true when electronAPI exists', () => {
    (window as any).electronAPI = {};
    const result = useRuntimeEnv();
    expect(result.isElectron).toBe(true);
    expect(result.isDesktop).toBe(true);
    expect(result.isChrome).toBe(false);
    expect(result.isDesktopLike).toBe(true);
  });

  it('returns isChrome=true when __chromeExtBus exists', () => {
    (window as any).__chromeExtBus = {};
    const result = useRuntimeEnv();
    expect(result.isElectron).toBe(false);
    expect(result.isDesktop).toBe(false);
    expect(result.isChrome).toBe(true);
    expect(result.isDesktopLike).toBe(true);
  });

  it('returns all false when no platform APIs exist', () => {
    const result = useRuntimeEnv();
    expect(result.isElectron).toBe(false);
    expect(result.isDesktop).toBe(false);
    expect(result.isChrome).toBe(false);
    expect(result.isDesktopLike).toBe(false);
  });

  it('returns both true when both platforms exist', () => {
    (window as any).electronAPI = {};
    (window as any).__chromeExtBus = {};
    const result = useRuntimeEnv();
    expect(result.isElectron).toBe(true);
    expect(result.isDesktop).toBe(true);
    expect(result.isChrome).toBe(true);
    expect(result.isDesktopLike).toBe(true);
  });
});
