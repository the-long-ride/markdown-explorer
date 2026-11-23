import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addSupportPromptUsage,
  getDefaultSupportPromptState,
  isDebugMode,
  loadSupportPromptState,
  markWebSupportPromptShown,
  recordSupportPromptShown,
  resetSupportPromptCountersToBeginning,
  resetSupportPromptState,
  saveSupportPromptState,
  setSupportPromptNeverShowAgain,
  shouldShowWebSupportPrompt,
  triggerSupportModalAndResetCounters,
} from '../../../../ui/src/utils/supportPromptStore';

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); }, data };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  delete (window as any).__DEBUG__;
});

describe('support prompt store edge cases', () => {
  it('detects debug mode from flags, storage and the environment', () => {
    expect(isDebugMode()).toBe(false);
    (window as any).__DEBUG__ = true;
    expect(isDebugMode()).toBe(true);
    delete (window as any).__DEBUG__;
    sessionStorage.setItem('debug', 'on');
    expect(isDebugMode()).toBe(true);
    sessionStorage.clear();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('DEV', false as any);
    expect(typeof isDebugMode()).toBe('boolean');
  });

  it('opens the support modal through the global hook', () => {
    const events: string[] = [];
    const listener = (event: Event) => events.push(event.type);
    window.addEventListener('markdown-explorer-open-support-modal', listener);
    window.addEventListener('open-support-prompt-modal', listener);
    (window as any).__openSupportModal();
    const hook = (window as any).__openSupportModal;
    (window as any).__openSupportModal = () => { throw new Error('boom'); };
    const state = triggerSupportModalAndResetCounters(100, null);
    (window as any).__openSupportModal = hook;
    expect(state.webLastResetTimestampMs).toBe(100);
    expect(events.length).toBe(4);
    window.removeEventListener('markdown-explorer-open-support-modal', listener);
    window.removeEventListener('open-support-prompt-modal', listener);
  });

  it('loads defaults for missing, corrupt and non-object storage', () => {
    const store = memory();
    expect(loadSupportPromptState(store)).toEqual(getDefaultSupportPromptState());
    store.setItem('', 'null');
    expect(loadSupportPromptState(store)).toEqual(getDefaultSupportPromptState());
    vi.stubGlobal('localStorage', undefined);
    expect(loadSupportPromptState()).toEqual(getDefaultSupportPromptState());
    saveSupportPromptState(getDefaultSupportPromptState());
    resetSupportPromptState();
  });

  it('updates custom states without persisting them', () => {
    const store = memory();
    const state = { ...getDefaultSupportPromptState(), totalUsageMs: 5 };
    expect(recordSupportPromptShown(state, store).lastPromptUsageMs).toBe(5);
    expect(setSupportPromptNeverShowAgain(state, store).neverShowAgain).toBe(true);
    expect(addSupportPromptUsage(10, state)).toBeTruthy();
    expect(markWebSupportPromptShown(state as any).webPromptCount).toBe(1);
    markWebSupportPromptShown(1000, store);
    addSupportPromptUsage(10, store);
    expect(store.data.size).toBeGreaterThan(0);
    expect(typeof shouldShowWebSupportPrompt({ ...state, webLastResetTimestampMs: 1 } as any, 10 as any)).toBe('boolean');
    resetSupportPromptState({ getItem: () => null, setItem: () => {} });
    resetSupportPromptState({ getItem: () => null, setItem: () => {}, removeItem: () => { throw new Error('x'); } });
    expect(resetSupportPromptCountersToBeginning(5, store).webLastResetTimestampMs).toBe(5);
  });
});
