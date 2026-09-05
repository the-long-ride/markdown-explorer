import { beforeEach, describe, expect, it } from 'vitest';
import { SUPPORT_PROMPT_STATE_STORAGE_KEY } from '../../../ui/src/constants/storage';
import {
  addSupportPromptUsage,
  getDefaultSupportPromptState,
  isDebugMode,
  loadSupportPromptState,
  recordSupportPromptShown,
  resetSupportPromptState,
  saveSupportPromptState,
  setSupportPromptNeverShowAgain,
  shouldShowSupportPrompt,
  SUPPORT_PROMPT_FIRST_THRESHOLD_MS,
  SUPPORT_PROMPT_REPEAT_INTERVAL_MS,
  type SupportPromptState,
} from '../../../ui/src/utils/supportPromptStore';

describe('supportPromptStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates clean default state', () => {
    const state = getDefaultSupportPromptState();
    expect(state.totalUsageMs).toBe(0);
    expect(state.lastPromptUsageMs).toBe(0);
    expect(state.neverShowAgain).toBe(false);
  });

  it('loads default state when localStorage is empty or corrupt', () => {
    expect(loadSupportPromptState()).toEqual(getDefaultSupportPromptState());

    localStorage.setItem(SUPPORT_PROMPT_STATE_STORAGE_KEY, 'invalid json');
    expect(loadSupportPromptState()).toEqual(getDefaultSupportPromptState());

    localStorage.setItem(SUPPORT_PROMPT_STATE_STORAGE_KEY, JSON.stringify({ totalUsageMs: 'invalid' }));
    expect(loadSupportPromptState().totalUsageMs).toBe(0);
  });

  it('loads legacy star prompt state if new key is missing', () => {
    localStorage.setItem('markdown-explorer-star-prompt-state-v1', JSON.stringify({
      totalUsageMs: 9000000,
      lastPromptUsageMs: 7200000,
      neverShowAgain: false,
    }));

    const state = loadSupportPromptState();
    expect(state.totalUsageMs).toBe(9000000);
    expect(state.lastPromptUsageMs).toBe(7200000);
  });

  it('saves and loads state properly', () => {
    const customState: SupportPromptState = {
      totalUsageMs: 5000,
      lastPromptUsageMs: 4000,
      neverShowAgain: false,
    };
    saveSupportPromptState(customState);
    expect(loadSupportPromptState()).toEqual(customState);
  });

  it('should not show prompt before 2 hours threshold', () => {
    const state = getDefaultSupportPromptState();
    state.totalUsageMs = SUPPORT_PROMPT_FIRST_THRESHOLD_MS - 1;
    expect(shouldShowSupportPrompt(state)).toBe(false);
  });

  it('should show prompt after reaching 2 hours threshold for first time', () => {
    const state = getDefaultSupportPromptState();
    state.totalUsageMs = SUPPORT_PROMPT_FIRST_THRESHOLD_MS;
    expect(shouldShowSupportPrompt(state)).toBe(true);

    state.totalUsageMs = SUPPORT_PROMPT_FIRST_THRESHOLD_MS + 1000;
    expect(shouldShowSupportPrompt(state)).toBe(true);
  });

  it('never shows prompt if neverShowAgain is true', () => {
    const state: SupportPromptState = {
      totalUsageMs: SUPPORT_PROMPT_FIRST_THRESHOLD_MS * 10,
      lastPromptUsageMs: 0,
      neverShowAgain: true,
    };
    expect(shouldShowSupportPrompt(state)).toBe(false);
  });

  it('handles repeat interval after being shown once', () => {
    let state = getDefaultSupportPromptState();
    state.totalUsageMs = SUPPORT_PROMPT_FIRST_THRESHOLD_MS;
    expect(shouldShowSupportPrompt(state)).toBe(true);

    // Record shown at 2h
    state = recordSupportPromptShown(state);
    expect(state.lastPromptUsageMs).toBe(SUPPORT_PROMPT_FIRST_THRESHOLD_MS);

    // Immediately after being shown, shouldShowSupportPrompt is false
    expect(shouldShowSupportPrompt(state)).toBe(false);

    // 10 hours of additional usage: should still be false (< 24h)
    state.totalUsageMs += 10 * 3600 * 1000;
    expect(shouldShowSupportPrompt(state)).toBe(false);

    // 24 hours of additional usage reached: should be true
    state.totalUsageMs = SUPPORT_PROMPT_FIRST_THRESHOLD_MS + SUPPORT_PROMPT_REPEAT_INTERVAL_MS;
    expect(shouldShowSupportPrompt(state)).toBe(true);
  });

  it('addSupportPromptUsage accumulates time and ignores negative deltas', () => {
    addSupportPromptUsage(5000);
    expect(loadSupportPromptState().totalUsageMs).toBe(5000);

    addSupportPromptUsage(-1000);
    expect(loadSupportPromptState().totalUsageMs).toBe(5000);

    addSupportPromptUsage(2500);
    expect(loadSupportPromptState().totalUsageMs).toBe(7500);
  });

  it('setSupportPromptNeverShowAgain persists neverShowAgain flag', () => {
    setSupportPromptNeverShowAgain();
    const state = loadSupportPromptState();
    expect(state.neverShowAgain).toBe(true);
    expect(shouldShowSupportPrompt(state)).toBe(false);
  });

  it('resetSupportPromptState clears storage keys', () => {
    addSupportPromptUsage(10000);
    expect(loadSupportPromptState().totalUsageMs).toBe(10000);
    resetSupportPromptState();
    expect(loadSupportPromptState().totalUsageMs).toBe(0);
  });

  describe('debug mode behavior', () => {
    it('always shows prompt when isDebug is true, even with 0 usage or neverShowAgain', () => {
      const state = getDefaultSupportPromptState();
      expect(shouldShowSupportPrompt(state, true)).toBe(true);

      state.neverShowAgain = true;
      expect(shouldShowSupportPrompt(state, true)).toBe(true);

      state.lastPromptUsageMs = 10000;
      state.totalUsageMs = 10000;
      expect(shouldShowSupportPrompt(state, true)).toBe(true);
    });

    it('detects debug mode from window.__DEBUG__', () => {
      (window as any).__DEBUG__ = true;
      expect(isDebugMode()).toBe(true);
      delete (window as any).__DEBUG__;
    });

    it('detects debug mode from window.__MARKDOWN_EXPLORER_DEBUG__', () => {
      (window as any).__MARKDOWN_EXPLORER_DEBUG__ = true;
      expect(isDebugMode()).toBe(true);
      delete (window as any).__MARKDOWN_EXPLORER_DEBUG__;
    });

    it('detects debug mode from localStorage', () => {
      localStorage.setItem('markdown-explorer-debug', 'true');
      expect(isDebugMode()).toBe(true);
      localStorage.removeItem('markdown-explorer-debug');

      localStorage.setItem('debug', '1');
      expect(isDebugMode()).toBe(true);
      localStorage.removeItem('debug');
    });

    it('detects debug mode from sessionStorage', () => {
      sessionStorage.setItem('markdown-explorer-debug', 'true');
      expect(isDebugMode()).toBe(true);
      sessionStorage.removeItem('markdown-explorer-debug');
    });

    it('detects debug mode from URL search parameters and hash', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, search: '?debug=1' } as any;

      expect(isDebugMode()).toBe(true);

      window.location = { ...originalLocation, search: '?mode=debug' } as any;
      expect(isDebugMode()).toBe(true);

      window.location = { ...originalLocation, search: '', hash: '#debug' } as any;
      expect(isDebugMode()).toBe(true);

      window.location = originalLocation;
    });

    it('exposes __openSupportModal and __showSupportPrompt global helpers on window', () => {
      expect(typeof (window as any).__openSupportModal).toBe('function');
      expect(typeof (window as any).__showSupportPrompt).toBe('function');
    });

    it('returns false when no debug flags are set in test environment', () => {
      expect(isDebugMode()).toBe(false);
    });
  });
});

